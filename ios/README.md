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

### 2. Embed `LivenessView` in your own UI

Drop `LivenessView` into any view hierarchy. The host owns the page chrome (heading, copy, Start button) and listens to delegate callbacks; the SDK draws camera + face frame + progress ring inside the view's bounds.

```swift
import LivenessDetection

final class MyViewController: UIViewController, LivenessDetectorDelegate {
  private let livenessView = LivenessView()
  private let slot = UIView()   // your circular UI slot

  override func viewDidLoad() {
    super.viewDidLoad()
    slot.layer.cornerRadius = 140
    slot.clipsToBounds = true
    slot.backgroundColor = UIColor(red: 0.357, green: 0.204, blue: 0.839, alpha: 1)
    // ... layout slot in your hierarchy ...

    let config = LivenessConfig()
    config.shape              = "circle"          // or "oval"
    config.showInstructions   = false             // host renders its own text/dots
    config.minSize            = 240               // floor on shape diameter (pt)
    config.progressColor      = UIColor(red: 0.102, green: 0.059, blue: 0.302, alpha: 1)
    config.progressErrorColor = UIColor(red: 1, green: 0.231, blue: 0.231, alpha: 1)
    config.progressWidth      = 4
    config.progressLineCap    = "round"           // or "square" / "butt"
    config.overlayColor       = UIColor(red: 0.357, green: 0.204, blue: 0.839, alpha: 1) // match your bg
    livenessView.config = config
    livenessView.delegate = self

    livenessView.translatesAutoresizingMaskIntoConstraints = false
    slot.addSubview(livenessView)
    NSLayoutConstraint.activate([
      livenessView.topAnchor.constraint(equalTo: slot.topAnchor),
      livenessView.bottomAnchor.constraint(equalTo: slot.bottomAnchor),
      livenessView.leadingAnchor.constraint(equalTo: slot.leadingAnchor),
      livenessView.trailingAnchor.constraint(equalTo: slot.trailingAnchor),
    ])

    livenessView.start()    // camera permission must already be granted
  }

  func onChallengeChanged(stepIndex: Int, stepLabel: String) { /* update your status */ }
  func onFaceInOval(inside: Bool, reason: String?) { /* show your hint */ }
  func onLivenessPassed(imageData: Data) { /* done */ }
  func onFailure(reason: String) { /* handle */ }
  func onFaceDetected(boundingBox: CGRect?) {}
}
```

All new UI options are optional — omit them for the original full-screen oval behaviour.

Sounds still play in embed mode and with `showInstructions = false` — only the visuals are hidden.

A complete worked example (yellow page, purple circle slot, host-owned Start button) lives at [`demo-apps/ios/LivenessDemo/EmbedViewController.swift`](../demo-apps/ios/LivenessDemo/EmbedViewController.swift).

### 3. Drive the raw `LivenessDetector` yourself

If you need full control over the preview surface (no `LivenessView`), use `LivenessDetector` directly:

```swift
final class MyViewController: UIViewController, LivenessDetectorDelegate {
  private var detector: LivenessDetector?
  private let previewView = UIView()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.addSubview(previewView)
    let config = LivenessConfig()
    config.yawTurnDelta = 9
    detector = LivenessDetector(config: config, delegate: self)
    detector?.startLiveness(previewView: previewView, useFrontCamera: true)
  }
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
- **UI / theme**: `shape` (`"oval"` or `"circle"`), `showInstructions`, `minSize`, `progressColor`, `progressErrorColor`, `progressWidth`, `progressLineCap`, `overlayColor`, `overlayErrorColor`.

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
