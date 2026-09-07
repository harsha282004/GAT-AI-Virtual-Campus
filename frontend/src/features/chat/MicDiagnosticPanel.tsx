"use client";

import { useState } from "react";

import { runMicDiagnostics } from "@/lib/micDiagnostics";
import type { MicDiagnosticReport } from "@/lib/micDiagnostics";

function StatusLine({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink/70">{label}</span>
      <span className={ok ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
        {ok ? "SUCCESS" : "FAILED"}
        {detail ? ` (${detail})` : ""}
      </span>
    </div>
  );
}

/** Dev-only microphone diagnostic — see lib/micDiagnostics.ts. Rendered
 * only behind a NODE_ENV check by ChatInput.tsx; never shipped to
 * production end users. Exists specifically because the "no microphone
 * found" investigation needs REAL data from the machine it's failing on,
 * not more guesswork — see that investigation's Phase 3/4/15. */
export function MicDiagnosticPanel() {
  const [report, setReport] = useState<MicDiagnosticReport | null>(null);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      setReport(await runMicDiagnostics());
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-1 rounded-xl border border-dashed border-amber-400/60 bg-amber-50/60 p-3 text-xs dark:bg-amber-950/20">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Microphone diagnostic (dev only)
        </span>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="rounded-full bg-amber-500 px-3 py-1 font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {running ? "Running…" : report ? "Run again" : "Run diagnostic"}
        </button>
      </div>

      {report && (
        <div className="mt-2.5 space-y-2 border-t border-amber-400/40 pt-2.5">
          <StatusLine label="navigator.mediaDevices" ok={report.mediaDevicesSupported} />
          <StatusLine label="getUserMedia supported" ok={report.getUserMediaSupported} />
          <StatusLine label="enumerateDevices supported" ok={report.enumerateDevicesSupported} />
          <StatusLine label="SpeechRecognition constructor" ok={report.speechRecognitionSupported} />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink/70">Permission state</span>
            <span className="font-medium text-ink">{report.permissionState}</span>
          </div>
          <StatusLine
            label="getUserMedia({audio:true}) call"
            ok={report.getUserMedia.success}
            detail={report.getUserMedia.errorName}
          />

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink/70">Audio input devices (before / after permission)</span>
            <span className="font-medium text-ink">
              {report.devicesBeforeVsAfter.audioInputCountBeforePermission} /{" "}
              {report.devicesBeforeVsAfter.audioInputCountAfterPermission}
            </span>
          </div>

          {report.audioTrack && (
            <div className="rounded-lg bg-white/70 p-2 dark:bg-black/20">
              <p className="font-semibold text-ink">Audio track</p>
              <p>Label: {report.audioTrack.label || "(empty — normal on some drivers)"}</p>
              <p>State: {report.audioTrack.readyState}</p>
              <p>Enabled: {String(report.audioTrack.enabled)} · Muted: {String(report.audioTrack.muted)}</p>
            </div>
          )}

          {report.audioInputDevices.length > 0 && (
            <div className="rounded-lg bg-white/70 p-2 dark:bg-black/20">
              <p className="mb-1 font-semibold text-ink">Detected audioinput devices</p>
              <ul className="space-y-0.5">
                {report.audioInputDevices.map((d) => (
                  <li key={d.deviceId} className="truncate">
                    {d.label || "(no label)"} — id {d.deviceId.slice(0, 10)}…
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.notes.length > 0 && (
            <div className="rounded-lg bg-white/70 p-2 dark:bg-black/20">
              <p className="mb-1 font-semibold text-ink">Notes</p>
              <ul className="list-disc space-y-1 pl-4">
                {report.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
