package com.liveness.detection

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner

/**
 * Embeddable liveness view. Drop into any layout (XML or programmatic), assign a
 * [listener], optionally tune [config]/[sounds]/[modelUrl], then call [start].
 *
 * - Match `match_parent` to take over the screen.
 * - Wrap a sized container (e.g. a circular slot) to embed the camera in your own UI;
 *   in that case set `config.showInstructions = false` so the host owns text and buttons.
 *
 * Camera permission must be granted by the host before calling [start].
 */
class LivenessView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
  defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr), LivenessListener {

  private val density = context.resources.displayMetrics.density

  private val previewView: PreviewView = PreviewView(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
  }
  private val overlayView: LivenessOvalOverlayView = LivenessOvalOverlayView(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
  }
  private val hintView: LivenessHintView = LivenessHintView(context).apply {
    layoutParams = LayoutParams((52 * density).toInt(), (52 * density).toInt(), Gravity.CENTER_HORIZONTAL).apply {
      topMargin = (180 * density).toInt()
    }
  }
  private val instructionText: TextView = TextView(context).apply {
    layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL).apply {
      topMargin = (220 * density).toInt()
    }
    text = "Position your face in the oval"
    setTextColor(Color.WHITE)
    textSize = 17f
    typeface = Typeface.DEFAULT_BOLD
    setShadowLayer(8f, 0f, 1f, 0x80000000.toInt())
  }
  private val posHintText: TextView = TextView(context).apply {
    layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL).apply {
      topMargin = (260 * density).toInt()
    }
    setTextColor(Color.parseColor("#ff3b3b"))
    textSize = 13f
    gravity = Gravity.CENTER
    visibility = View.GONE
  }

  private var detector: LivenessDetector? = null

  /** Tuning + UI options. Re-assign at any time to update theme/shape/visibility. */
  var config: LivenessConfig = LivenessConfig()
    set(value) {
      field = value
      applyConfig()
    }

  /** Per-step sounds (left/blink/right/nod/mouth/good/capture). */
  var sounds: LivenessSoundOptions? = null

  /** Override the MediaPipe Face Landmarker model URL. Defaults to Google's hosted float16 model. */
  var modelUrl: String? = null

  /** Callbacks for the host. Will be invoked on the main thread. */
  var listener: LivenessListener? = null

  init {
    addView(previewView)
    addView(overlayView)
    addView(hintView)
    addView(instructionText)
    addView(posHintText)
    applyConfig()
  }

  private fun applyConfig() {
    overlayView.applyStyle(config)
    overlayView.setStepCount(LivenessStep.resolve(config.steps).size)
    val show = config.showInstructions
    instructionText.visibility = if (show) View.VISIBLE else View.GONE
    hintView.visibility = if (show) View.VISIBLE else View.GONE
    if (!show) posHintText.visibility = View.GONE
    posHintText.setTextColor(config.progressErrorColor)
  }

  /** Number of steps the current session will run (after applying `config.steps`). */
  val sessionStepCount: Int
    get() = LivenessStep.resolve(config.steps).size

  /**
   * Begin liveness. Camera permission must be granted by the host.
   * [lifecycleOwner] binds CameraX — typically the host Activity or Fragment.
   */
  fun start(lifecycleOwner: LifecycleOwner) {
    stop()
    val url = modelUrl ?: ModelDownloader.DEFAULT_MODEL_URL
    if (config.showInstructions) instructionText.text = "Downloading model..."

    ModelDownloader.downloadIfNeeded(
      context = context,
      url = url,
      fileName = "face_landmarker.task",
      maxAttempts = config.cdnMaxRetries,
      attemptTimeoutMs = config.cdnAttemptTimeoutMs.toInt(),
      connectivityCheckTimeoutMs = config.connectivityCheckTimeoutMs.toInt(),
      onSuccess = { file ->
        post {
          if (config.showInstructions) instructionText.text = "Position your face in the oval"
          val det = LivenessDetector(context, this, config, sounds)
          detector = det
          det.startLiveness(lifecycleOwner, previewView, true, ModelSource.FilePath(file.absolutePath))
        }
      },
      onError = { error ->
        post { listener?.onFailure(error) }
      }
    )
  }

  /** Stop detection and release the camera. Safe to call repeatedly. */
  fun stop() {
    detector?.stop()
    detector = null
  }

  // ── LivenessListener (internal — updates UI then forwards to [listener]) ──

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
    post {
      if (config.showInstructions) instructionText.text = stepLabel
      val total = sessionStepCount
      if (stepIndex >= 0) {
        overlayView.setProgress(stepIndex)
        overlayView.setStepDots(stepIndex)
        hintView.setHint(stepLabel)
      } else {
        overlayView.setProgress(total)
        overlayView.setStepDots(total)
        hintView.setHint(null)
      }
      listener?.onChallengeChanged(stepIndex, stepLabel)
    }
  }

  override fun onFaceInOval(inside: Boolean, reason: String?) {
    post {
      overlayView.setFaceInOval(inside)
      if (config.showInstructions) {
        posHintText.visibility = if (inside) View.GONE else View.VISIBLE
        posHintText.text = reason ?: ""
      }
      listener?.onFaceInOval(inside, reason)
    }
  }

  override fun onLivenessPassed(imageBytes: ByteArray) {
    post { listener?.onLivenessPassed(imageBytes) }
  }

  override fun onFailure(reason: String) {
    post { listener?.onFailure(reason) }
  }

  override fun onFaceDetected(boundingBox: android.graphics.RectF?) {
    listener?.onFaceDetected(boundingBox)
  }
}
