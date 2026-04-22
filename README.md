# Cross-Platform Liveness Detection Library

Production-ready, on-device liveness detection built on **MediaPipe Face Landmarker**. The reference implementation is the **web SDK** ([`web-sdk/`](web-sdk/)); native Android, native iOS, Capacitor, and React Native packages are behaviourally aligned with it — same state machine, same thresholds, same error contract, same UX.

## Monorepo layout

```
/
├── web-sdk/                    # @daboss2003/liveness-web (reference implementation)
├── android/                    # Kotlin library → AAR
├── ios/                        # Swift framework → XCFramework
├── capacitor-plugin/           # @daboss/liveness-capacitor
├── react-native-module/        # @daboss/liveness-react-native (TurboModule + WebView fallback)
├── demo-apps/
│   ├── android/                # Android demo app
│   ├── ios/                    # iOS demo app
│   ├── react-native/           # Expo demo for @daboss/liveness-react-native
│   ├── capacitor/              # Capacitor demo for @daboss/liveness-capacitor
│   └── web/                    # Web demo (Vite + @daboss2003/liveness-web)
└── docs/                       # Architecture, thresholds, wrapping guides
```

## Behaviour contract (shared across all SDKs)

- **Five challenge steps**, labels: `Turn your head LEFT`, `Blink`, `Turn your head RIGHT`, `Nod your head`, `Open your mouth`. Randomised per session (disable via `config.shuffleSteps`).
- **Relative baseline**: during a `readyMs` window (1800ms) the SDK samples 8 frames of the user's resting pose and measures yaw/pitch deltas against that baseline — so someone sitting slightly turned doesn't have to fight their natural position.
- **Face-in-oval** with min/max face-size checks; vertical-only during head turns.
- **Capture gate**: head frontal + eyes open + mouth closed for up to 90 frames after the last step.
- **Multi-face failure**: if more than one face is detected, the session fails with a clear message.
- **Model download retry**: up to 5 attempts with a connectivity probe; falls back to structured error codes (see below).
- **Sounds**: per-step (`left` / `blink` / `right` / `nod` / `mouth`), plus `good` between steps and `capture` before the final frame. Override individual keys or set `baseUrl` and the SDK joins `${key}.mp3`.

### Error codes

Both values are exported from every package:

| Code | Meaning |
|---|---|
| `offline` (`LIVENESS_ERROR_OFFLINE`) | No internet connection (connectivity probe failed). |
| `cdnNotAvailable` (`LIVENESS_ERROR_CDN_NOT_AVAILABLE`) | Model / WASM host unreachable after retries (internet confirmed). |

Compare `failure.reason` / the rejected promise message against these constants to show friendly messages.

## Quick start

### Web — [`web-sdk/`](web-sdk/) · npm `@daboss2003/liveness-web`

```ts
import { startLiveness, isOfflineError, isCdnNotAvailableError } from "@daboss2003/liveness-web";

startLiveness({
  callbacks: {
    onChallengeChanged: (i, label) => console.log(i, label),
    onSuccess: (base64) => console.log("passed", base64.length),
    onFailure: (reason) => {
      if (isOfflineError(reason)) alert("You're offline.");
      else if (isCdnNotAvailableError(reason)) alert("Try again later.");
      else alert(reason);
    },
  },
});
```

Run the web demo: `cd demo-apps/web && npm install && npm run dev`.

### Android — [`android/`](android/)

```kotlin
LivenessActivity.startForResult(
  activity = this,
  requestCode = 9001,
  configJson = JSONObject().put("yawTurnDelta", 9).toString(),
  soundsJson = JSONObject().put("baseUrl", "file:///android_asset/liveness-sounds").toString(),
)
// In onActivityResult:
val reason = data?.getStringExtra(LivenessActivity.EXTRA_FAILURE_REASON).orEmpty()
if (LivenessErrorCodes.isOffline(reason)) { /* ... */ }
```

Or use `LivenessDetector` directly with your own `PreviewView` + overlay. See [`demo-apps/android/`](demo-apps/android/).

### iOS — [`ios/`](ios/)

```swift
let config = LivenessConfig()
config.yawTurnDelta = 9

LivenessDetector.presentLiveness(
  from: self,
  modelUrl: nil,
  sounds: LivenessSoundOptions(baseUrl: "https://example.com/sounds"),
  config: config,
  onChallengeChanged: { idx, label in print(idx, label) },
  onFaceInOval: { _, _ in },
  onSuccess: { data in print("passed", data.count) },
  onFailure: { reason in
    if LivenessErrorCodes.isOffline(reason) { /* ... */ }
  }
)
```

See [`demo-apps/ios/`](demo-apps/ios/).

### Capacitor — [`capacitor-plugin/`](capacitor-plugin/) · npm `@daboss/liveness-capacitor`

```ts
import {
  LivenessDetector,
  LIVENESS_ERROR_OFFLINE,
  LIVENESS_ERROR_CDN_NOT_AVAILABLE,
} from "@daboss/liveness-capacitor";

LivenessDetector.addListener("challengeChanged", (e) => console.log(e));
LivenessDetector.addListener("faceInOval", (e) => console.log(e));

try {
  const { imageBase64 } = await LivenessDetector.startLiveness({
    config: { yawTurnDelta: 9, shuffleSteps: true },
    sounds: { baseUrl: "https://example.com/sounds" },
  });
} catch (err: any) {
  if (err.message === LIVENESS_ERROR_OFFLINE) { /* ... */ }
}
```

Full demo at [`demo-apps/capacitor/`](demo-apps/capacitor/).

### React Native / Expo — [`react-native-module/`](react-native-module/) · npm `@daboss/liveness-react-native`

Two modes ship in one package:

**Native (TurboModule)** — presents the SDK-owned native controller:
```tsx
import { startLiveness, addChallengeChangedListener } from "@daboss/liveness-react-native";

const sub = addChallengeChangedListener((e) => console.log(e));
const { imageBase64 } = await startLiveness({
  config: { yawTurnDelta: 9 },
  sounds: { baseUrl: "https://example.com/sounds" },
});
```

**WebView (web-SDK parity)** — runs `@daboss2003/liveness-web` inside a WebView, giving you the full browser experience inside the native app:
```tsx
import { LivenessWebView } from "@daboss/liveness-react-native";

<LivenessWebView
  onChallengeChanged={(e) => {}}
  onFaceInOval={(e) => {}}
  onLivenessPassed={(e) => console.log(e.imageBase64.length)}
  onFailure={(e) => console.log(e.reason)}
  style={{ flex: 1 }}
/>
```

Full demo at [`demo-apps/react-native/`](demo-apps/react-native/).

## Configuration surface

Every SDK accepts the same tunable thresholds. Omit the `config` option entirely for web-SDK-parity defaults. Keys (all optional):

`readyMs`, `sessionTimeoutMs`, `baselineFrames`, `yawTurnDelta`, `yawWrongDirDelta`, `headTurnHoldMs`, `nodDownDelta`, `nodReturnFraction`, `nodReturnMaxDelta`, `blinkClosedThreshold`, `blinkOpenThreshold`, `earClosedThreshold`, `earOpenThreshold`, `blinkMaxDurationMs`, `mouthOpenThreshold`, `mouthOpenMarThreshold`, `mouthHoldMs`, `maxYawDuringBlink`, `maxPitchDuringBlink`, `maxYawDuringNod`, `maxYawDuringMouth`, `maxPitchDuringMouth`, `ovalCx`, `ovalCy`, `ovalRx`, `ovalRy`, `minFaceSize`, `maxFaceSize`, `captureDelayMs`, `captureMaxAttempts`, `captureMaxYaw`, `captureMaxPitch`, `captureMaxMouthScore`, `captureMaxBlinkScore`, `captureMinEar`, `captureMaxMar`, `shuffleSteps`, `cdnMaxRetries`, `cdnAttemptTimeoutMs`, `connectivityCheckTimeoutMs`.

See [`web-sdk/src/engine.ts`](web-sdk/src/engine.ts) for the authoritative default values and in-code commentary on what each knob does.

## More

- [`docs/README.md`](docs/README.md) — architecture, threshold tuning, wrapping guides.
- Each package ships its own README with platform-specific build and integration notes.
