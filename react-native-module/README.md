# @daboss/liveness-react-native

React Native liveness detection — ships with **three modes** so you can pick the one that fits your app:

1. **Native TurboModule** (imperative) — presents the SDK-owned full-screen Android/iOS controller. Best UX, smallest JS surface.
2. **`<LivenessView />`** (embedded native UI) — drop a native view into your JSX inside any sized container. Host owns the page chrome; the SDK renders camera + face frame + progress ring inside the view's bounds.
3. **`<LivenessWebView />`** — runs the real [`@daboss2003/liveness-web`](../web-sdk/) SDK inside a WebView. Full browser behaviour inside the native app.

Both modes share the same behaviour contract: 5 randomised challenges, relative-baseline state machine, capture gate, multi-face failure, `offline` / `cdnNotAvailable` error codes.

## Install

```bash
npm install @daboss/liveness-react-native react-native-webview
```

Expo (config plugin is auto-registered):

```bash
npx expo install @daboss/liveness-react-native react-native-webview
npx expo prebuild
```

### iOS permission

Add to `Info.plist` (Expo: use `app.json → ios.infoPlist.NSCameraUsageDescription`):

```xml
<key>NSCameraUsageDescription</key>
<string>This app uses the camera for liveness verification.</string>
```

### Android permission

Already declared in the module's manifest (`CAMERA`, `INTERNET`) — merged automatically.

## Mode 1 — Native TurboModule

```tsx
import {
  startLiveness,
  stop,
  addChallengeChangedListener,
  addFailureListener,
  addFaceInOvalListener,
  LIVENESS_ERROR_OFFLINE,
  LIVENESS_ERROR_CDN_NOT_AVAILABLE,
} from "@daboss/liveness-react-native";

useEffect(() => {
  const s1 = addChallengeChangedListener((e) => console.log(e));
  const s2 = addFaceInOvalListener((e) => console.log(e));
  const s3 = addFailureListener((e) => console.warn(e));
  return () => { s1.remove(); s2.remove(); s3.remove(); };
}, []);

async function run() {
  try {
    const { imageBase64 } = await startLiveness({
      config: { yawTurnDelta: 9, shuffleSteps: true },
      sounds: { baseUrl: "https://example.com/sounds" },
    });
    // imageBase64 is a JPEG encoded as base64
  } catch (err: any) {
    if (err.message === LIVENESS_ERROR_OFFLINE) showOfflineUi();
    else if (err.message === LIVENESS_ERROR_CDN_NOT_AVAILABLE) showCdnErrorUi();
    else showFailureUi(err.message);
  }
}
```

`startLiveness(options?)` returns a promise; `stop()` is a best-effort abort.

## Mode 2 — `<LivenessView />` (embedded native UI)

Drop the native camera + face frame into any JSX hierarchy. The host owns surrounding chrome (heading, status, Start button); the SDK renders inside the view's bounds.

```tsx
import { LivenessView } from "@daboss/liveness-react-native";
import { useState } from "react";

const [started, setStarted] = useState(false);

<View style={{ width: 280, height: 280, borderRadius: 140, overflow: "hidden" }}>
  <LivenessView
    started={started}
    style={StyleSheet.absoluteFill}
    config={{
      shape:            "circle",     // or "oval"
      showInstructions: false,        // host renders its own text
      minSize:          240,
      progressColor:    "#1A0F4D",
      progressErrorColor: "#FF3B3B",
      progressWidth:    4,
      progressLineCap:  "round",      // "square" | "butt"
      overlayColor:     "#5B34D6",    // match your bg
      overlayErrorColor:"#99B40000",
    }}
    onChallengeChanged={({ stepLabel }) => setStatus(stepLabel)}
    onFaceInOval={({ inside, reason }) => { if (!inside) setStatus(reason ?? ""); }}
    onSuccess={(b64) => { /* done */ }}
    onFailure={(reason) => { /* … */ }}
  />
</View>
```

Camera permission must be granted before the view starts. Setting `started: false` stops detection and releases the camera.

A worked example (yellow page, purple circle slot, host-owned Start button) lives at [`demo-apps/react-native/EmbedScreen.tsx`](../demo-apps/react-native/EmbedScreen.tsx).

## Mode 3 — `<LivenessWebView />`

```tsx
import { LivenessWebView } from "@daboss/liveness-react-native";

<LivenessWebView
  style={{ flex: 1 }}
  onChallengeChanged={(e) => console.log(`Step ${e.stepIndex + 1}: ${e.stepLabel}`)}
  onFaceInOval={(e) => !e.inside && console.log("hint:", e.reason)}
  onLivenessPassed={(e) => console.log("passed", e.imageBase64.length)}
  onFailure={(e) => console.warn(e.reason)}
/>
```

Props:

- `modelUrl?`, `wasmUrl?` — override MediaPipe asset URLs.
- `webSdkVersion?` — version or dist-tag of `@daboss2003/liveness-web` to load (default `"latest"`, via jsDelivr ESM).
- `webSdkUrl?` — fully-qualified ESM URL; overrides `webSdkVersion`.
- `sounds?: LivenessSoundOptions` — same shape as mode 1.

The WebView loads the web SDK dynamically so your bundled JS stays small. If you need offline asset control, pin a specific `webSdkVersion`.

## Configuration surface

Every key is optional; omit to use web-SDK-parity defaults.

**Tuning / behaviour:** `readyMs`, `sessionTimeoutMs`, `baselineFrames`, `yawTurnDelta`, `yawWrongDirDelta`, `headTurnHoldMs`, `nodDownDelta`, `nodReturnFraction`, `nodReturnMaxDelta`, `blinkClosedThreshold`, `blinkOpenThreshold`, `earClosedThreshold`, `earOpenThreshold`, `blinkMaxDurationMs`, `mouthOpenThreshold`, `mouthOpenMarThreshold`, `mouthHoldMs`, `maxYawDuringBlink`, `maxPitchDuringBlink`, `maxYawDuringNod`, `maxYawDuringMouth`, `maxPitchDuringMouth`, `ovalCx`, `ovalCy`, `ovalRx`, `ovalRy`, `minFaceSize`, `maxFaceSize`, `captureDelayMs`, `captureMaxAttempts`, `captureMaxYaw`, `captureMaxPitch`, `captureMaxMouthScore`, `captureMaxBlinkScore`, `captureMinEar`, `captureMaxMar`, `shuffleSteps`, `cdnMaxRetries`, `cdnAttemptTimeoutMs`, `connectivityCheckTimeoutMs`.

**UI / theme** (applies to native modes): `shape` (`"oval"` or `"circle"`), `showInstructions`, `minSize`, `progressColor`, `progressErrorColor`, `progressWidth`, `progressLineCap`, `overlayColor`, `overlayErrorColor`. Colours are CSS-style hex strings (`"#12c95c"` or `"#FF12c95c"`).

## Sounds

`LivenessSoundOptions` accepts a `baseUrl` (joined with `${key}.mp3`) and/or per-key overrides for `left`, `blink`, `right`, `nod`, `mouth`, `good`, `capture`.

## Example

See [`demo-apps/react-native/`](../demo-apps/react-native/) for a runnable Expo example that shows both modes.
