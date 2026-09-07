/** Development-only microphone diagnostic (see useSpeechRecognition.ts's
 * "no microphone found" investigation). Runs every check Phase 3 of that
 * investigation asks for and returns a plain, serializable report so it
 * can be rendered directly in the UI — no DevTools console required — to
 * separate four distinct possible failure points:
 *   A. Windows/laptop hardware or driver visibility
 *   B. Browser microphone permission
 *   C. getUserMedia's own device acquisition
 *   D. The Web Speech API (SpeechRecognition) — a SEPARATE mechanism from
 *      getUserMedia with no device-selection of its own; it can fail even
 *      when getUserMedia above it succeeds (see the report's own notes).
 *
 * Never used in production UI — only imported behind a NODE_ENV check.
 */

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface MicDiagnosticReport {
  timestamp: string;
  mediaDevicesSupported: boolean;
  getUserMediaSupported: boolean;
  enumerateDevicesSupported: boolean;
  speechRecognitionSupported: boolean;
  permissionState: "granted" | "denied" | "prompt" | "unsupported" | "error";
  getUserMedia: {
    attempted: boolean;
    success: boolean;
    errorName?: string;
    errorMessage?: string;
  };
  audioTrack: {
    label: string;
    readyState: MediaStreamTrackState;
    enabled: boolean;
    muted: boolean;
  } | null;
  devicesBeforeVsAfter: {
    audioInputCountBeforePermission: number;
    audioInputCountAfterPermission: number;
  };
  audioInputDevices: DeviceInfo[];
  notes: string[];
}

async function safeEnumerate(): Promise<DeviceInfo[]> {
  if (typeof navigator.mediaDevices?.enumerateDevices !== "function") return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "audioinput")
    .map((d) => ({ deviceId: d.deviceId, label: d.label, kind: d.kind }));
}

export async function runMicDiagnostics(): Promise<MicDiagnosticReport> {
  const notes: string[] = [];
  const mediaDevicesSupported = typeof navigator.mediaDevices === "object";
  const getUserMediaSupported = typeof navigator.mediaDevices?.getUserMedia === "function";
  const enumerateDevicesSupported = typeof navigator.mediaDevices?.enumerateDevices === "function";
  const speechRecognitionSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  let permissionState: MicDiagnosticReport["permissionState"] = "unsupported";
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      permissionState = status.state as "granted" | "denied" | "prompt";
    }
  } catch {
    permissionState = "error";
    notes.push("navigator.permissions.query('microphone') isn't supported by this browser — not unusual, ignore.");
  }

  // Device labels/count are deliberately checked BEFORE and AFTER the
  // getUserMedia call: per spec, browsers hide real labels (and may
  // under-report count) until permission is granted — a diagnostic that
  // only checks enumerateDevices() *before* requesting permission would
  // wrongly look like "no microphone exists" even on a perfectly normal
  // machine. This is the exact mistake Phase 2/Phase 15 warned about.
  const beforeDevices = await safeEnumerate();

  const result: MicDiagnosticReport["getUserMedia"] = { attempted: false, success: false };
  let stream: MediaStream | null = null;
  if (getUserMediaSupported) {
    result.attempted = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      result.success = true;
    } catch (err) {
      result.success = false;
      if (err instanceof DOMException) {
        result.errorName = err.name;
        result.errorMessage = err.message;
      } else {
        result.errorMessage = String(err);
      }
    }
  } else {
    notes.push("navigator.mediaDevices.getUserMedia is not a function in this browser/context.");
  }

  let audioTrack: MicDiagnosticReport["audioTrack"] = null;
  if (stream) {
    const track = stream.getAudioTracks()[0];
    if (track) {
      audioTrack = { label: track.label, readyState: track.readyState, enabled: track.enabled, muted: track.muted };
    }
    stream.getTracks().forEach((t) => t.stop());
  }

  const afterDevices = await safeEnumerate();

  if (result.success && afterDevices.length === 0) {
    notes.push(
      "getUserMedia succeeded but enumerateDevices() still reports 0 audioinput devices — unusual; may indicate a browser/OS enumeration quirk rather than a real hardware problem.",
    );
  }
  if (!result.success && afterDevices.length > 0) {
    notes.push(
      `getUserMedia FAILED (${result.errorName}) even though ${afterDevices.length} audioinput device(s) are enumerable. This points to a Windows *default device* problem (commonly the "Default Communication Device" role stuck on a disconnected Bluetooth entry), not missing hardware — Speech recognition and getUserMedia both ultimately depend on that same OS-level default resolution when no deviceId is specified.`,
    );
  }
  if (result.success && speechRecognitionSupported) {
    notes.push(
      "getUserMedia succeeded — a real microphone is accessible to this page. If pressing the actual mic button still fails, SpeechRecognition (a separate API with no device-selection of its own) is failing independently of this check — see the app's error message when that happens.",
    );
  }
  if (!speechRecognitionSupported) {
    notes.push("This browser has no SpeechRecognition/webkitSpeechRecognition constructor at all — voice input cannot work here regardless of microphone availability.");
  }

  return {
    timestamp: new Date().toISOString(),
    mediaDevicesSupported,
    getUserMediaSupported,
    enumerateDevicesSupported,
    speechRecognitionSupported,
    permissionState,
    getUserMedia: result,
    audioTrack,
    devicesBeforeVsAfter: {
      audioInputCountBeforePermission: beforeDevices.length,
      audioInputCountAfterPermission: afterDevices.length,
    },
    audioInputDevices: afterDevices,
    notes,
  };
}
