# Android demo app

Minimal Android app that consumes the local [`android/liveness`](../../android/liveness) module and launches `LivenessActivity` (the SDK-owned full-screen UI).

## Run

Open [`demo-apps/android`](.) in Android Studio, or from the command line:

```bash
cd demo-apps/android
./gradlew :app:installDebug
adb shell am start -n com.liveness.demo/.MainActivity
```

The demo's Gradle settings already include the library as a project dependency:

```groovy
include ':liveness'
project(':liveness').projectDir = file('../../android/liveness')
```

So edits in [`android/liveness/`](../../android/liveness) rebuild automatically.

## What to look for

- **Start button** launches `LivenessActivity` with:
  - a `config` JSON extra (`yawTurnDelta = 9`, `shuffleSteps = true`).
  - a `sounds` JSON extra pointing at bundled assets (edit the path to match your own).
- **Result handling** uses `LivenessErrorCodes.isOffline(..)` / `.isCdnNotAvailable(..)` to render friendly copy for model-download failures.
- On success, the activity returns the captured JPEG as base64 via `EXTRA_IMAGE_BASE64`.

See [`MainActivity.kt`](app/src/main/java/com/liveness/demo/MainActivity.kt) for the full 40-line integration.
