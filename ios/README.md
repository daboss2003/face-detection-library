# iOS Liveness SDK (Swift)

On-device liveness detection for iOS, built on **MediaPipe Face Landmarker** (`MediaPipeTasksVision`) and `AVCaptureSession`. Behaviourally identical to [`@daboss2003/liveness-web`](../web-sdk/) — same 5 randomised challenges, same relative-baseline state machine, same capture gate, same error codes.

## Install

Build the XCFramework via [`build_xcframework.sh`](build_xcframework.sh) and drag it into your Xcode project, or integrate via CocoaPods:

```ruby
# Podfile
pod 'MediaPipeTasksVision'
# Add LivenessDetection as a local development pod or subproject.
```

You also need `face_landmarker.task` — either bundled in your app or downloaded via `ModelDownloader` (which already handles retry + offline detection).

Add to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>This app uses the camera for liveness verification.</string>
```

## Two usage modes

### 1. SDK-owned full-screen UI (recommended)

```swift
import LivenessDetection

let config = LivenessConfig()
config.yawTurnDelta = 9

LivenessDetector.presentLiveness(
  from: self,
  modelUrl: nil,                  // nil = default hosted model
  sounds: LivenessSoundOptions(baseUrl: "https://example.com/sounds"),
  config: config,
  onChallengeChanged: { idx, label in print("Step \(idx + 1): \(label)") },
  onFaceInOval: { inside, reason in },
  onSuccess: { data in
    // `data` is a JPEG Data object
  },
  onFailure: { reason in
    if LivenessErrorCodes.isOffline(reason) {
      // show offline UI
    } else if LivenessErrorCodes.isCdnNotAvailable(reason) {
      // show CDN error UI
    }
  }
)
```

A Swift-friendly overload with defaults is also provided:

```swift
LivenessDetector.presentLiveness(from: self,
  onSuccess: { data in ... },
  onFailure: { reason in ... }
)
```

### 2. Embed `LivenessDetector` in your own view

```swift
final class MyViewController: UIViewController, LivenessDetectorDelegate {
  private var detector: LivenessDetector?
  private let previewView = UIView()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.addSubview(previewView)
    // ... layout constraints ...

    let config = LivenessConfig()
    config.yawTurnDelta = 9
    detector = LivenessDetector(config: config, delegate: self)
    detector?.startLiveness(previewView: previewView, useFrontCamera: true)
  }

  func onChallengeChanged(stepIndex: Int, stepLabel: String) { /* ... */ }
  func onLivenessPassed(imageData: Data) { /* ... */ }
  func onFailure(reason: String) { /* ... */ }
}
```

## Configuration

`LivenessConfig` mirrors every knob from the web SDK. Default values are set in the initialiser — mutate only what you need.

- **Baseline & pose**: `readyMs`, `baselineFrames`, `yawTurnDelta`, `yawWrongDirDelta`, `headTurnHoldMs`, `nodDownDelta`, `nodReturnFraction`, `nodReturnMaxDelta`.
- **Blink**: `blinkClosedThreshold`, `blinkOpenThreshold`, `earClosedThreshold`, `earOpenThreshold`, `blinkMaxDurationMs`.
- **Mouth**: `mouthOpenThreshold`, `mouthOpenMarThreshold`, `mouthHoldMs`.
- **Oval**: `ovalCx/Cy/Rx/Ry`, `minFaceSize`, `maxFaceSize`.
- **Capture**: `captureDelayMs`, `captureMaxAttempts`, `captureMaxYaw`, `captureMaxPitch`, `captureMaxMouthScore`, `captureMaxBlinkScore`, `captureMinEar`, `captureMaxMar`.
- **Model download**: `cdnMaxRetries`, `cdnAttemptTimeoutMs`, `connectivityCheckTimeoutMs`.
- **Behaviour**: `shuffleSteps`, `sessionTimeoutMs`.

See [`LivenessConfig.swift`](LivenessDetection/LivenessConfig.swift) for exact defaults.

## Error codes

```swift
LivenessErrorCodes.offline              // "offline"
LivenessErrorCodes.cdnNotAvailable      // "cdnNotAvailable"

LivenessErrorCodes.isOffline(reason)
LivenessErrorCodes.isCdnNotAvailable(reason)
```

`ModelDownloader` retries up to `config.cdnMaxRetries` times with a connectivity probe before surfacing these codes.

## Sounds

`LivenessSoundOptions` accepts a `baseUrl` (SDK joins `${key}.mp3`) and/or per-key overrides for `left`, `blink`, `right`, `nod`, `mouth`, `good`, `capture`. Accepts `https://` URLs or file paths.

## Example

See [`demo-apps/ios/`](../demo-apps/ios/) for a runnable example.
