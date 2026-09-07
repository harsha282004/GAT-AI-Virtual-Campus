<#
.SYNOPSIS
    Stop ONLY the GAT AI Virtual Campus dev services (FastAPI + Next.js).

.DESCRIPTION
    Targets, and only targets:
        - anything listening on 127.0.0.1:8000  (the pinned GAT backend socket)
        - anything listening on *:3001          (the pinned GAT frontend port)
        - PowerShell / python / node processes whose command line points into
          this repo ("Virtual Campus") and runs uvicorn / next / npm dev

    Each target is terminated with its whole child tree (taskkill /T), which
    also cleans up uvicorn worker subprocesses and Next.js children.

    HARD SAFETY VETOES (a process matching ANY of these is never touched):
        - it is also listening on port 3000            -> that's ORCA
        - its name starts with 'com.docker'            -> Docker
        - its command line contains 'docker'
        - it is a PostgreSQL or Ollama process
    PostgreSQL and Ollama are shared services and are always left running.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\stop-project.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

$RepoMarker    = 'Virtual Campus'
$BackendPort   = 8000
$FrontendPort  = 3001
$ForbiddenPort = 3000

function Write-Ok  ($m) { Write-Host "  [ OK ]  $m" -ForegroundColor Green }
function Write-Skip($m) { Write-Host "  [SKIP]  $m" -ForegroundColor DarkGray }
function Write-Act ($m) { Write-Host "  [STOP]  $m" -ForegroundColor Yellow }

Write-Host "`nStopping GAT AI Virtual Campus services (ORCA on port $ForbiddenPort will NOT be touched)..." -ForegroundColor Cyan

# The absolute do-not-touch set: every PID with a listener on port 3000.
$forbiddenPids = @()
Get-NetTCPConnection -State Listen -LocalPort $ForbiddenPort -ErrorAction SilentlyContinue |
    ForEach-Object { $forbiddenPids += [int]$_.OwningProcess }
if ($forbiddenPids.Count -gt 0) {
    Write-Host "    port $ForbiddenPort is owned by PID(s) $($forbiddenPids -join ', ') - these are protected (ORCA)." -ForegroundColor DarkGray
}

$targets = New-Object System.Collections.Generic.HashSet[int]

# 1. Listeners on the pinned GAT sockets.
foreach ($row in (Get-NetTCPConnection -State Listen -LocalAddress '127.0.0.1' -LocalPort $BackendPort -ErrorAction SilentlyContinue)) {
    [void]$targets.Add([int]$row.OwningProcess)
}
foreach ($row in (Get-NetTCPConnection -State Listen -LocalPort $FrontendPort -ErrorAction SilentlyContinue)) {
    [void]$targets.Add([int]$row.OwningProcess)
}

# 2. Repo-scoped dev processes (the two launcher windows + their servers).
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine -like "*$RepoMarker*" -and (
        $_.CommandLine -like '*uvicorn*app.main:app*' -or
        $_.CommandLine -like '*next*dev*'             -or
        $_.CommandLine -like '*npm*run*dev*'          -or
        $_.CommandLine -like '*start-project.ps1*'    -or
        $_.CommandLine -like "*GAT backend :$BackendPort*" -or
        $_.CommandLine -like "*GAT frontend :$FrontendPort*"
    )
} | ForEach-Object { [void]$targets.Add([int]$_.ProcessId) }

if ($targets.Count -eq 0) {
    Write-Host "  Nothing to stop - no GAT backend/frontend process is running." -ForegroundColor Gray
    Write-Host ""
    exit 0
}

$stopped = 0
foreach ($processId in $targets) {
    if ($processId -le 4) { continue }
    if ($forbiddenPids -contains $processId) { Write-Skip "PID $processId is on port $ForbiddenPort (ORCA) - refusing"; continue }

    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if ($null -eq $p) { continue }
    $name = "$($p.Name)"
    $cmd  = "$($p.CommandLine)"

    if ($name -like 'com.docker*' -or $cmd -like '*docker*') { Write-Skip "PID $processId ($name) is Docker - refusing"; continue }
    if ($name -match 'postgres' -or $cmd -match 'postgres')  { Write-Skip "PID $processId ($name) is PostgreSQL - refusing"; continue }
    if ($name -like 'ollama*'   -or $cmd -like '*ollama*')   { Write-Skip "PID $processId ($name) is Ollama - refusing"; continue }

    & taskkill /PID $processId /T /F 2>&1 | Out-Null
    Write-Act "PID $processId ($name) + child tree"
    $stopped++
}

Start-Sleep -Seconds 2

$backendUp  = [bool](Get-NetTCPConnection -State Listen -LocalAddress '127.0.0.1' -LocalPort $BackendPort  -ErrorAction SilentlyContinue)
$frontendUp = [bool](Get-NetTCPConnection -State Listen -LocalPort $FrontendPort -ErrorAction SilentlyContinue)

Write-Host ""
if (-not $backendUp)  { Write-Ok "backend  (127.0.0.1:$BackendPort) is stopped" }  else { Write-Host "  [WARN]  something still listening on 127.0.0.1:$BackendPort" -ForegroundColor Yellow }
if (-not $frontendUp) { Write-Ok "frontend (port $FrontendPort) is stopped" }        else { Write-Host "  [WARN]  something still listening on port $FrontendPort" -ForegroundColor Yellow }
Write-Host "  PostgreSQL and Ollama left running (shared services). ORCA (port $ForbiddenPort) not touched." -ForegroundColor Gray
Write-Host ""
