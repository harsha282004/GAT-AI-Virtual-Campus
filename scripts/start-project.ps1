<#
.SYNOPSIS
    Start the GAT AI Virtual Campus full stack for local development.

.DESCRIPTION
    Starts every service the project needs and then health-checks each one
    before reporting success:

        1. PostgreSQL   (Windows service 'postgresql-x64-18')  - verified / started
        2. Ollama       (http://localhost:11434)               - verified / started (unless -SkipOllama)
        3. FastAPI      (http://127.0.0.1:8000)                 - launched in its own window
        4. Next.js      (http://localhost:3001)                 - launched in its own window

    The backend and frontend each open in a SEPARATE PowerShell window so you
    can watch their logs and stop them with Ctrl+C.

    PORT SAFETY: this script NEVER kills a process and NEVER touches port 3000.
    Port 3000 belongs to the separate ORCA project. The GAT backend is pinned
    to 127.0.0.1:8000 and the GAT frontend to port 3001 so the two projects
    never collide.

.PARAMETER SkipOllama
    Do not verify or start Ollama. The Virtual Tour and all read APIs still
    work; only the AI Assistant's answer generation needs Ollama.

.PARAMETER BackendOnly
    Start only infrastructure + FastAPI (no Next.js window).

.PARAMETER FrontendOnly
    Start only Next.js (assumes the backend is already running).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\start-project.ps1

.EXAMPLE
    npm run start:dev        # from the repo root - same thing
#>
[CmdletBinding()]
param(
    [switch]$SkipOllama,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------
$RepoRoot     = Split-Path -Parent $PSScriptRoot
$FrontendDir  = Join-Path $RepoRoot 'frontend'
$BackendHost  = '127.0.0.1'
$BackendPort  = 8000
$FrontendPort = 3001
$OllamaPort   = 11434
$PgPort       = 5432
$PgService    = 'postgresql-x64-18'
$RequiredModel = 'llama3.2'
$OrcaPort     = 3000

function Write-Step   ($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok     ($m) { Write-Host "    [ OK ]  $m" -ForegroundColor Green }
function Write-WarnMsg($m) { Write-Host "    [WARN]  $m" -ForegroundColor Yellow }
function Write-ErrMsg ($m) { Write-Host "    [FAIL]  $m" -ForegroundColor Red }

function Test-Port {
    param([string]$TargetHost = '127.0.0.1', [int]$Port, [int]$TimeoutMs = 1000)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne($TimeoutMs)) {
            $client.EndConnect($iar); return $true
        }
        return $false
    } catch { return $false }
    finally { $client.Close() }
}

function Invoke-Http {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        return Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSec -Method Get
    } catch { return $null }
}

function Wait-For {
    param([string]$Name, [scriptblock]$Check, [int]$Retries = 60, [int]$DelaySec = 2)
    for ($i = 1; $i -le $Retries; $i++) {
        if (& $Check) { return $true }
        Start-Sleep -Seconds $DelaySec
        Write-Host ("    ... waiting for {0} ({1}/{2})" -f $Name, $i, $Retries) -ForegroundColor DarkGray
    }
    return $false
}

# --------------------------------------------------------------------------
# 0. Sanity: repo layout + Python venv
# --------------------------------------------------------------------------
Write-Step "GAT AI Virtual Campus - startup"
Write-Host  "    repo root: $RepoRoot"

if (-not (Test-Path (Join-Path $RepoRoot '.env'))) {
    Write-ErrMsg "No .env at repo root. Copy .env.example to .env and fill it in."
    exit 1
}
if (-not (Test-Path (Join-Path $FrontendDir '.env.local'))) {
    Write-WarnMsg "frontend\.env.local missing - the frontend will fall back to http://127.0.0.1:8000/api/v1 (usually fine)."
}

# Prefer repo-root venv (matches .vscode/settings.json); fall back to backend\venv.
$VenvPython = $null
foreach ($cand in @((Join-Path $RepoRoot 'venv\Scripts\python.exe'),
                    (Join-Path $RepoRoot 'backend\venv\Scripts\python.exe'))) {
    if (Test-Path $cand) { $VenvPython = $cand; break }
}
if (-not $VenvPython) {
    Write-ErrMsg "No Python venv found (looked for venv\ and backend\venv\)."
    Write-Host   "    Create one:  python -m venv venv ; .\venv\Scripts\Activate.ps1 ; pip install -r requirements.txt"
    exit 1
}
Write-Ok "Python venv: $VenvPython"

# --------------------------------------------------------------------------
# 1. PostgreSQL (required by the backend)
# --------------------------------------------------------------------------
if (-not $FrontendOnly) {
    Write-Step "PostgreSQL (port $PgPort)"
    if (Test-Port -TargetHost '127.0.0.1' -Port $PgPort) {
        Write-Ok "already accepting connections on 127.0.0.1:$PgPort"
    } else {
        $svc = Get-Service -Name $PgService -ErrorAction SilentlyContinue
        if ($null -ne $svc) {
            Write-Host "    service '$PgService' is $($svc.Status) - starting it..."
            try { Start-Service -Name $PgService; Start-Sleep -Seconds 3 } catch { }
        }
        if (Test-Port -TargetHost '127.0.0.1' -Port $PgPort) {
            Write-Ok "PostgreSQL is up"
        } else {
            Write-ErrMsg "PostgreSQL is not reachable on 127.0.0.1:$PgPort and could not be started."
            Write-Host   "    Start it manually (Services app -> $PgService) and re-run."
            exit 1
        }
    }
}

# --------------------------------------------------------------------------
# 2. Ollama (only needed for the AI Assistant's answer generation)
# --------------------------------------------------------------------------
if (-not $FrontendOnly -and -not $SkipOllama) {
    Write-Step "Ollama (port $OllamaPort)"
    if (Test-Port -TargetHost '127.0.0.1' -Port $OllamaPort) {
        Write-Ok "already running on 127.0.0.1:$OllamaPort"
    } else {
        $ollamaExe = (Get-Command ollama -ErrorAction SilentlyContinue)
        if ($null -ne $ollamaExe) {
            Write-Host "    starting 'ollama serve' in the background..."
            Start-Process -FilePath $ollamaExe.Source -ArgumentList 'serve' -WindowStyle Hidden
            Start-Sleep -Seconds 3
        }
        if (Test-Port -TargetHost '127.0.0.1' -Port $OllamaPort) {
            Write-Ok "Ollama is up"
        } else {
            Write-WarnMsg "Ollama not reachable. The tour and read APIs still work; the AI Assistant will not generate answers."
        }
    }

    if (Test-Port -TargetHost '127.0.0.1' -Port $OllamaPort) {
        try {
            $tags = Invoke-Http "http://127.0.0.1:$OllamaPort/api/tags"
            $names = @()
            if ($null -ne $tags -and $null -ne $tags.models) { $names = $tags.models | ForEach-Object { $_.name } }
            if (($names -join ' ') -match [regex]::Escape($RequiredModel)) {
                Write-Ok "model '$RequiredModel' is present"
            } else {
                Write-WarnMsg "model '$RequiredModel' not found in Ollama. Run:  ollama pull $RequiredModel"
            }
        } catch { Write-WarnMsg "could not query Ollama model list ($_)" }
    }
} elseif ($SkipOllama) {
    Write-Step "Ollama - skipped (-SkipOllama)"
}

# --------------------------------------------------------------------------
# 3. Report ORCA on port 3000 - informational only, NEVER touched
# --------------------------------------------------------------------------
Write-Step "Port $OrcaPort (ORCA - not managed by this script)"
if (Test-Port -TargetHost '127.0.0.1' -Port $OrcaPort) {
    Write-Ok "something is listening on port $OrcaPort - left untouched (assumed to be your ORCA project)"
} else {
    Write-Host "    nothing on port $OrcaPort right now - nothing to do"
}

# --------------------------------------------------------------------------
# 4. FastAPI backend  ->  127.0.0.1:8000  (own window)
# --------------------------------------------------------------------------
if (-not $FrontendOnly) {
    Write-Step "FastAPI backend  ->  http://$BackendHost`:$BackendPort"
    $health = Invoke-Http "http://$BackendHost`:$BackendPort/health" 3
    if ($null -ne $health -and $health.status -eq 'ok' -and -not ($health.PSObject.Properties.Name -contains 'service' -and $health.service -like '*orca*')) {
        Write-Ok "GAT backend already healthy - not starting a second one"
    } else {
        $backendCmd = @"
`$Host.UI.RawUI.WindowTitle = 'GAT backend :$BackendPort'
Set-Location '$RepoRoot'
Write-Host 'Starting FastAPI (uvicorn) on $BackendHost`:$BackendPort ...' -ForegroundColor Cyan
& '$VenvPython' -m uvicorn app.main:app --app-dir backend --host $BackendHost --port $BackendPort
Write-Host 'Backend process exited.' -ForegroundColor Yellow
"@
        Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd)
        Write-Host "    launched in a new window - it performs a one-time RAG + LLM warmup (~20-60s) before it answers."

        $ok = Wait-For -Name 'backend /health' -Retries 60 -DelaySec 2 -Check {
            $h = Invoke-Http "http://$BackendHost`:$BackendPort/health" 3
            ($null -ne $h) -and ($h.status -eq 'ok') -and -not (($h.PSObject.Properties.Name -contains 'service') -and ($h.service -like '*orca*'))
        }
        if ($ok) { Write-Ok "backend is healthy at http://$BackendHost`:$BackendPort/health" }
        else     { Write-ErrMsg "backend did not become healthy in time - check its window for errors."; exit 1 }
    }
}

# --------------------------------------------------------------------------
# 5. Next.js frontend  ->  localhost:3001  (own window)
# --------------------------------------------------------------------------
if (-not $BackendOnly) {
    Write-Step "Next.js frontend  ->  http://localhost:$FrontendPort"

    $frontHtml = $null
    try { $frontHtml = (Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -TimeoutSec 3 -UseBasicParsing).Content } catch { }
    if ($null -ne $frontHtml -and $frontHtml -match 'Global Academy of Technology|GAT Virtual Campus') {
        Write-Ok "GAT frontend already serving on port $FrontendPort - not starting a second one"
    } elseif (Test-Port -TargetHost '127.0.0.1' -Port $FrontendPort) {
        Write-ErrMsg "port $FrontendPort is in use but is not the GAT frontend. Free it (do NOT touch 3000) or change `$FrontendPort."
        exit 1
    } else {
        if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
            Write-WarnMsg "frontend\node_modules missing - running 'npm install' first (one time)."
            Push-Location $FrontendDir; npm install; Pop-Location
        }
        $frontendCmd = @"
`$Host.UI.RawUI.WindowTitle = 'GAT frontend :$FrontendPort'
Set-Location '$FrontendDir'
Write-Host 'Starting Next.js on port $FrontendPort ...' -ForegroundColor Cyan
npm run dev -- -p $FrontendPort
Write-Host 'Frontend process exited.' -ForegroundColor Yellow
"@
        Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCmd)
        Write-Host "    launched in a new window."

        # Stage 1: the Next.js dev server binds the port quickly (~10-20s)...
        $portUp = Wait-For -Name 'frontend server' -Retries 45 -DelaySec 2 -Check {
            Test-Port -TargetHost '127.0.0.1' -Port $FrontendPort
        }
        if (-not $portUp) { Write-ErrMsg "Next.js dev server never bound port $FrontendPort - check its window."; exit 1 }
        Write-Ok "Next.js dev server is listening on port $FrontendPort"

        # Stage 2: ...then it compiles the first route on demand (can be 20-60s
        # with Turbopack on a cold cache). Give it generous time, but a bound
        # port already means the process is healthy.
        $contentOk = Wait-For -Name 'frontend first compile' -Retries 60 -DelaySec 3 -Check {
            try {
                $c = (Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -TimeoutSec 8 -UseBasicParsing).Content
                return ($c -match 'Global Academy of Technology|GAT Virtual Campus')
            } catch { return $false }
        }
        if ($contentOk) { Write-Ok "frontend is serving the GAT app at http://localhost:$FrontendPort" }
        else { Write-WarnMsg "port $FrontendPort is up but the first page compile is still finishing - it should be ready shortly; watch the frontend window." }
    }
}

# --------------------------------------------------------------------------
# 6. End-to-end health checks (do NOT claim success without these)
# --------------------------------------------------------------------------
Write-Step "Health checks"

$allGood = $true

$h = Invoke-Http "http://$BackendHost`:$BackendPort/health" 5
if ($null -ne $h -and $h.status -eq 'ok') { Write-Ok "backend /health -> ok" }
else { Write-ErrMsg "backend /health failed"; $allGood = $false }

if (-not $BackendOnly) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -TimeoutSec 20 -UseBasicParsing
        if ($resp.StatusCode -eq 200) { Write-Ok "frontend / -> HTTP 200" } else { Write-ErrMsg "frontend / -> HTTP $($resp.StatusCode)"; $allGood = $false }
    } catch {
        if (Test-Port -TargetHost '127.0.0.1' -Port $FrontendPort) {
            Write-WarnMsg "frontend port $FrontendPort is up but not answering yet (first compile) - not failing the run"
        } else {
            Write-ErrMsg "frontend / unreachable"; $allGood = $false
        }
    }
}

# Virtual Tour API - resolve Main Building then count its scenes
try {
    $buildings = Invoke-Http "http://$BackendHost`:$BackendPort/api/v1/buildings" 8
    $main = $buildings | Where-Object { $_.code -eq 'MAIN' } | Select-Object -First 1
    if ($null -ne $main) {
        $scenes = Invoke-Http "http://$BackendHost`:$BackendPort/api/v1/tour/scenes?building_id=$($main.id)" 15
        $count = 0; if ($null -ne $scenes) { $count = @($scenes).Count }
        if ($count -gt 0) { Write-Ok "tour API -> Main Building (id $($main.id)) has $count scenes" }
        else { Write-ErrMsg "tour API returned 0 scenes for Main Building - the tour will show its error state"; $allGood = $false }
    } else {
        Write-ErrMsg "no building with code 'MAIN' - the tour cannot load"; $allGood = $false
    }
} catch { Write-ErrMsg "tour API check failed: $_"; $allGood = $false }

# CORS: the browser origin (localhost:3001) must be allowed by the backend
try {
    $cors = Invoke-WebRequest -Uri "http://$BackendHost`:$BackendPort/api/v1/buildings" -Headers @{ Origin = "http://localhost:$FrontendPort" } -TimeoutSec 5 -UseBasicParsing
    $acao = $cors.Headers['Access-Control-Allow-Origin']
    if ($acao -eq "http://localhost:$FrontendPort") { Write-Ok "CORS allows http://localhost:$FrontendPort" }
    else { Write-WarnMsg "CORS did not echo http://localhost:$FrontendPort (got '$acao'). Add it to CORS_ALLOWED_ORIGINS in .env and restart the backend." }
} catch { Write-WarnMsg "could not verify CORS header ($_)" }

# Ollama (informational)
if (-not $SkipOllama -and (Test-Port -TargetHost '127.0.0.1' -Port $OllamaPort)) {
    Write-Ok "Ollama reachable - AI Assistant can generate answers"
} elseif (-not $SkipOllama) {
    Write-WarnMsg "Ollama not reachable - AI Assistant answers will fail (tour is unaffected)"
}

# --------------------------------------------------------------------------
# 7. Summary
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  GAT AI Virtual Campus" -ForegroundColor White
Write-Host "  Frontend : http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  Backend  : http://$BackendHost`:$BackendPort        (docs: /docs)" -ForegroundColor White
Write-Host "  Tour     : http://localhost:$FrontendPort/tour" -ForegroundColor White
Write-Host "  Assistant: http://localhost:$FrontendPort/chat" -ForegroundColor White
Write-Host "------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  PostgreSQL : service '$PgService' (port $PgPort)" -ForegroundColor Gray
Write-Host "  Ollama     : http://localhost:$OllamaPort  (model: $RequiredModel)" -ForegroundColor Gray
Write-Host "  ORCA       : port $OrcaPort - NOT managed here, never killed" -ForegroundColor Gray
Write-Host "------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Stop GAT services:  powershell -ExecutionPolicy Bypass -File scripts\stop-project.ps1" -ForegroundColor Gray
Write-Host "  (or just close the two 'GAT backend' / 'GAT frontend' windows)" -ForegroundColor Gray
Write-Host "======================================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "`nAll health checks passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSome health checks FAILED - see [FAIL] lines above." -ForegroundColor Red
    exit 1
}
