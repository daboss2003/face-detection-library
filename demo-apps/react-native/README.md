# Liveness React Native demo

Minimal Expo app that calls `@daboss/liveness-react-native` (the TurboModule) and
also demonstrates the `LivenessWebView` fallback (which runs the real web SDK
inside a WebView for full parity with the browser flow).

## Run

```bash
cd demo-apps/react-native
npm install
npx expo prebuild    # generates ios/ and android/ folders
npx expo run:ios     # or: npx expo run:android
```

The demo links `@daboss/liveness-react-native` via a `file:` dependency to the
local `../../react-native-module` so edits in the module propagate here.

## What to look for

- **Default run (`App.tsx`)**: uses the native SDK. Steps are randomised, a
  baseline of the user's resting pose is sampled, and the native overlay UI
  shows the oval, progress ring, dots, and animated hint.
- **`WebViewScreen.tsx`**: swap this in as the root component to run the full
  web SDK inside a WebView — identical behaviour to the web demo.
- **Error codes**: `LIVENESS_ERROR_OFFLINE` and `LIVENESS_ERROR_CDN_NOT_AVAILABLE`
  are surfaced on `startLiveness` rejection when the model host can't be
  reached (after 5 retries) or the device is offline.
