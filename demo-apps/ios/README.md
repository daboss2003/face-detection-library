# iOS demo app

Minimal iOS app that consumes the local [`ios/LivenessDetection`](../../ios/LivenessDetection) framework and calls `LivenessDetector.presentLiveness(...)` (the SDK-owned full-screen UI).

## Run

```bash
cd demo-apps/ios
pod install
open LivenessDemo.xcworkspace
```

Then build & run on a real device (the camera doesn't work in the simulator).

The Podfile pulls in `MediaPipeTasksVision` and uses a local path reference to the `LivenessDetection` framework at [`../../ios/`](../../ios/), so edits in the SDK rebuild here automatically.

## What to look for

- **Start button** calls `LivenessDetector.presentLiveness(...)` with:
  - a `LivenessConfig` tuned with `yawTurnDelta = 9` and `shuffleSteps = true`.
  - an `onChallengeChanged` callback that updates the label live.
  - an `onFailure` handler that maps `LivenessErrorCodes.isOffline(..)` / `.isCdnNotAvailable(..)` to friendly copy.
- On success, `onSuccess` receives the captured JPEG as `Data`.

See [`ViewController.swift`](LivenessDemo/ViewController.swift) for the full integration.

## Camera permission

[`Info.plist`](LivenessDemo/Info.plist) already declares `NSCameraUsageDescription`. iOS will prompt on first launch.
