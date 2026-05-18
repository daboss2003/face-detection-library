# Android Liveness SDK (Kotlin)

On-device liveness detection for Android, built on **MediaPipe Face Landmarker** and CameraX. Behaviourally identical to [`@daboss2003/liveness-web`](../web-sdk/) — same 5 randomised challenges, same relative-baseline state machine, same capture gate, same error codes.

## Install

Build the AAR from this project, or consume it via a local Gradle `implementation project(":liveness")` dependency.

```groovy
// settings.gradle
include ':liveness'
project(':liveness').projectDir = file('../../android/liveness')

// app/build.gradle
dependencies {
  implementation project(':liveness')
}
```

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Two usage modes

### 1. SDK-owned full-screen UI (recommended)

Launch `LivenessActivity` and read the result in your `ActivityResultLauncher`:

```kotlin
import com.liveness.detection.LivenessActivity
import com.liveness.detection.LivenessErrorCodes
import org.json.JSONObject

val launcher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
  if (result.resultCode == RESULT_OK) {
    val base64 = result.data?.getStringExtra(LivenessActivity.EXTRA_IMAGE_BASE64)
    // base64 is a JPEG image
  } else {
    val reason = result.data?.getStringExtra(LivenessActivity.EXTRA_FAILURE_REASON).orEmpty()
    when {
      LivenessErrorCodes.isOffline(reason) -> showOfflineUi()
      LivenessErrorCodes.isCdnNotAvailable(reason) -> showCdnErrorUi()
      else -> showFailureUi(reason)
    }
  }
}

val intent = Intent(this, LivenessActivity::class.java).apply {
  putExtra(
    LivenessActivity.EXTRA_CONFIG_JSON,
    JSONObject().put("yawTurnDelta", 9).toString()
  )
  putExtra(
    LivenessActivity.EXTRA_SOUNDS_JSON,
    JSONObject().put("baseUrl", "file:///android_asset/liveness-sounds").toString()
  )
}
launcher.launch(intent)
```

### 2. Embed `LivenessView` in your own layout

Drop `LivenessView` into any XML or Compose layout. The host owns the page chrome (heading, copy, Start button) and listens to callbacks; the SDK draws camera + face frame + progress ring inside the view's bounds.

```kotlin
import com.liveness.detection.LivenessConfig
import com.liveness.detection.LivenessListener
import com.liveness.detection.LivenessSoundOptions
import com.liveness.detection.LivenessView

val livenessView = LivenessView(this).apply {
  config = LivenessConfig(
    shape              = "circle",            // or "oval"
    showInstructions   = false,               // host renders its own text/dots
    minSizeDp          = 240f,                // floor on shape diameter
    progressColor      = Color.parseColor("#1A0F4D"),
    progressErrorColor = Color.parseColor("#FF3B3B"),
    progressWidthDp    = 4f,
    progressLineCap    = "round",             // or "square" / "butt"
    overlayColor       = Color.parseColor("#5B34D6"), // match your bg
    overlayErrorColor  = 0x99B40000.toInt(),
  )
  sounds = LivenessSoundOptions(baseUrl = "file:///android_asset/liveness-sounds")
  listener = object : LivenessListener {
    override fun onChallengeChanged(stepIndex: Int, stepLabel: String) { /* update your status */ }
    override fun onFaceInOval(inside: Boolean, reason: String?) { /* show your hint */ }
    override fun onLivenessPassed(imageBytes: ByteArray) { /* done */ }
    override fun onFailure(reason: String) { /* handle */ }
    override fun onFaceDetected(boundingBox: android.graphics.RectF?) {}
  }
}
mySlot.addView(livenessView)            // mySlot is your circular FrameLayout
livenessView.start(this)                // camera permission must already be granted
```

All new UI options are optional — omit them for the original full-screen oval behaviour.

Sounds still play in embed mode and with `showInstructions = false` — only the visuals are hidden.

A complete worked example (yellow page, purple circle slot, host-owned Start button) lives at [`demo-apps/android/app/src/main/java/com/liveness/demo/EmbedActivity.kt`](../demo-apps/android/app/src/main/java/com/liveness/demo/EmbedActivity.kt).

### 3. Drive the raw `LivenessDetector` yourself

If you need full control over the preview surface and listener wiring (no `LivenessView`), use `LivenessDetector` directly:

```kotlin
val detector = LivenessDetector(
  context = this,
  listener = object : LivenessListener { /* ... */ },
  config = LivenessConfig(yawTurnDelta = 9f),
  sounds = LivenessSoundOptions(baseUrl = "file:///android_asset/liveness-sounds"),
)

detector.startLiveness(
  lifecycleOwner = this,
  previewView = findViewById(R.id.liveness_preview),
  isFrontCamera = true,
  modelSource = ModelSource.Asset("face_landmarker.task"),
)
```

`ModelSource.Asset("face_landmarker.task")` loads from `assets/`. Use `ModelSource.FilePath(path)` after downloading via `ModelDownloader.downloadIfNeeded(...)`.

## Configuration

`LivenessConfig` mirrors every knob from the web SDK. Omit arguments for parity defaults. Key fields:

- **Baseline & pose**: `readyMs`, `baselineFrames`, `yawTurnDelta`, `yawWrongDirDelta`, `headTurnHoldMs`, `nodDownDelta`, `nodReturnFraction`, `nodReturnMaxDelta`.
- **Blink**: `blinkClosedThreshold`, `blinkOpenThreshold`, `earClosedThreshold`, `earOpenThreshold`, `blinkMaxDurationMs`.
- **Mouth**: `mouthOpenThreshold`, `mouthOpenMarThreshold`, `mouthHoldMs`.
- **Oval**: `ovalCx/Cy/Rx/Ry`, `minFaceSize`, `maxFaceSize`.
- **Capture**: `captureDelayMs`, `captureMaxAttempts`, `captureMaxYaw`, `captureMaxPitch`, `captureMaxMouthScore`, `captureMaxBlinkScore`, `captureMinEar`, `captureMaxMar`.
- **Model download**: `cdnMaxRetries`, `cdnAttemptTimeoutMs`, `connectivityCheckTimeoutMs`.
- **Behaviour**: `shuffleSteps`, `sessionTimeoutMs`.
- **UI / theme**: `shape` (`"oval"` or `"circle"`), `showInstructions`, `minSizeDp`, `progressColor`, `progressErrorColor`, `progressWidthDp`, `progressLineCap`, `overlayColor`, `overlayErrorColor`.

See [`LivenessConfig.kt`](liveness/src/main/java/com/liveness/detection/LivenessConfig.kt) for exact defaults.

## Error codes

```kotlin
import com.liveness.detection.LivenessErrorCodes

LivenessErrorCodes.OFFLINE             // "offline"
LivenessErrorCodes.CDN_NOT_AVAILABLE   // "cdnNotAvailable"

LivenessErrorCodes.isOffline(reason)
LivenessErrorCodes.isCdnNotAvailable(reason)
```

Both codes are emitted by `ModelDownloader` after a retry loop with a connectivity probe. Matches the web SDK contract.

## Sounds

`LivenessSoundOptions` accepts a `baseUrl` (SDK joins `${key}.mp3`) and/or per-key overrides for `left`, `blink`, `right`, `nod`, `mouth`, `good`, `capture`. Accepts `https://`, `file:///android_asset/...`, or any absolute path.

## Example

See [`demo-apps/android/`](../demo-apps/android/) for a runnable example.
