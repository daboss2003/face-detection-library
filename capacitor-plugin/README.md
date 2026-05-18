# @daboss/liveness-capacitor

Capacitor plugin that bridges the native Android and iOS Liveness SDKs to web/JS code. Behaviourally aligned with [`@daboss2003/liveness-web`](../web-sdk/) — same challenge set, same state machine, same error codes.

The plugin presents a full-screen native controller (no WebView camera) on both platforms, then returns the JPEG image as a base64 string.

## Install

```bash
npm install @daboss/liveness-capacitor
npx cap sync
```

### iOS permission

Add to `ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>This app uses the camera for liveness verification.</string>
```

### Android permission

Already declared in the plugin's `AndroidManifest.xml` (`CAMERA`, `INTERNET`). Capacitor will merge it into your app.

## Usage

```ts
import {
  LivenessDetector,
  LIVENESS_ERROR_OFFLINE,
  LIVENESS_ERROR_CDN_NOT_AVAILABLE,
} from "@daboss/liveness-capacitor";

// Continuous events
await LivenessDetector.addListener("challengeChanged", (e) => {
  console.log(`Step ${e.stepIndex + 1}: ${e.stepLabel}`);
});
await LivenessDetector.addListener("faceInOval", (e) => {
  if (!e.inside) console.log("hint:", e.reason);
});
await LivenessDetector.addListener("failure", (e) => {
  console.warn(e.reason);
});

// Start (returns the captured image on success)
try {
  const { imageBase64 } = await LivenessDetector.startLiveness({
    modelUrl: undefined, // omit for default hosted model
    config: {
      yawTurnDelta: 9,
      shuffleSteps: true,
    },
    sounds: {
      baseUrl: "https://example.com/sounds",
      // or per-key:
      // left: "...", blink: "...", right: "...", nod: "...", mouth: "...",
      // good: "...", capture: "...",
    },
  });
  // imageBase64 is a JPEG encoded as base64
} catch (err: any) {
  if (err.message === LIVENESS_ERROR_OFFLINE) showOfflineUi();
  else if (err.message === LIVENESS_ERROR_CDN_NOT_AVAILABLE) showCdnErrorUi();
  else showFailureUi(err.message);
}
```

## API

### `startLiveness(options?): Promise<{ imageBase64 }>`

Opens the native liveness UI and resolves with the captured JPEG as a base64 string.

Options (all optional):

- `modelUrl?: string` — override the MediaPipe model URL.
- `sounds?: LivenessSoundOptions` — `baseUrl` and/or per-key overrides for `left`, `blink`, `right`, `nod`, `mouth`, `good`, `capture`.
- `config?: LivenessConfigOptions` — any subset of the web SDK's tuning knobs. See [`definitions.ts`](src/definitions.ts) for the full list.
- `soundBaseUrl?: string` — **deprecated**, use `sounds.baseUrl`.

### `stop(): Promise<void>`

Aborts an in-flight session (best-effort; the native controller may still be dismissing).

### Events

- `challengeChanged` → `{ stepIndex, stepLabel }`
- `faceInOval` → `{ inside, reason? }`
- `failure` → `{ reason }`

### Error codes

`LIVENESS_ERROR_OFFLINE` (`"offline"`) and `LIVENESS_ERROR_CDN_NOT_AVAILABLE` (`"cdnNotAvailable"`) are exported as constants. Compare them against the rejected promise's message or the `failure` event's `reason`.

## Configuration surface

Every key is optional; omit to use web-SDK-parity defaults.

**Tuning / behaviour:** `readyMs`, `sessionTimeoutMs`, `baselineFrames`, `yawTurnDelta`, `yawWrongDirDelta`, `headTurnHoldMs`, `nodDownDelta`, `nodReturnFraction`, `nodReturnMaxDelta`, `blinkClosedThreshold`, `blinkOpenThreshold`, `earClosedThreshold`, `earOpenThreshold`, `blinkMaxDurationMs`, `mouthOpenThreshold`, `mouthOpenMarThreshold`, `mouthHoldMs`, `maxYawDuringBlink`, `maxPitchDuringBlink`, `maxYawDuringNod`, `maxYawDuringMouth`, `maxPitchDuringMouth`, `ovalCx`, `ovalCy`, `ovalRx`, `ovalRy`, `minFaceSize`, `maxFaceSize`, `captureDelayMs`, `captureMaxAttempts`, `captureMaxYaw`, `captureMaxPitch`, `captureMaxMouthScore`, `captureMaxBlinkScore`, `captureMinEar`, `captureMaxMar`, `shuffleSteps`, `cdnMaxRetries`, `cdnAttemptTimeoutMs`, `connectivityCheckTimeoutMs`.

**UI / theme:** `shape` (`"oval"` or `"circle"`), `showInstructions`, `minSize`, `progressColor`, `progressErrorColor`, `progressWidth`, `progressLineCap`, `overlayColor`, `overlayErrorColor`. Colours are CSS-style hex strings (`"#12c95c"` or `"#FF12c95c"`).

> Capacitor renders the camera full-screen over the WebView. If you need the camera _embedded_ inside an HTML slot (like the screenshot demo for the web SDK), use [`@daboss2003/liveness-web`](../web-sdk/) directly from your Capacitor app's WebView — its `embed` mode is the right tool for that layout.

## Example

See [`demo-apps/capacitor/`](../demo-apps/capacitor/) for a runnable Vite + Capacitor example.
