# Liveness Capacitor demo

Minimal Vite + Capacitor shell that calls `@daboss/liveness-capacitor` on iOS
and Android. Web builds run in the browser, but the liveness plugin itself only
activates on the native platforms (the plugin presents a full-screen native
controller with the SDK-owned UI).

## Run

```bash
cd demo-apps/capacitor
npm install
npm run build
npx cap add ios         # first time only
npx cap add android     # first time only
npm run ios             # or: npm run android
```

The demo links `@daboss/liveness-capacitor` via a `file:` dependency to the
local `../../capacitor-plugin` so edits in the plugin propagate here.

## What to look for

- Start button triggers `LivenessDetector.startLiveness({ config, sounds })`.
  The plugin now accepts the full web-SDK config surface and per-key sound
  overrides (or a `sounds.baseUrl`).
- `challengeChanged` / `faceInOval` / `failure` events fire through
  `LivenessDetector.addListener(...)`.
- Errors compare cleanly against `LIVENESS_ERROR_OFFLINE` and
  `LIVENESS_ERROR_CDN_NOT_AVAILABLE` — matching the web SDK's error contract.

## iOS camera permission

Before running on iOS, add `NSCameraUsageDescription` to
`ios/App/App/Info.plist` (Capacitor will create this file after `cap add ios`).
