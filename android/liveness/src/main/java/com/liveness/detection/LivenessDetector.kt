package com.liveness.detection

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.camera.core.ImageAnalysis
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult

class LivenessDetector(
  private val context: Context,
  private val listener: LivenessListener,
  private val config: LivenessConfig = LivenessConfig(),
) : FaceLandmarkerPipeline.Listener {
  private var cameraController: CameraXController? = null
  private var landmarker: FaceLandmarkerPipeline? = null
  private var steps: List<LivenessStep> = LivenessStep.ordered
  private var stateMachine = LivenessStateMachine(config, steps)
  private val mainHandler = Handler(Looper.getMainLooper())
  private var latestMetrics: FaceMetrics? = null
  private var captureScheduled = false
  private var captureActive = false
  private var captureAttempts = 0
  private var captureDelayRunnable: Runnable? = null
  private var sessionTimeoutRunnable: Runnable? = null
  private var lastOvalState: Boolean? = null

  fun startLiveness(
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView?,
    isFrontCamera: Boolean = true,
    modelSource: ModelSource = ModelSource.Asset("face_landmarker.task"),
  ) {
    stop()
    val nowMs = System.currentTimeMillis()
    steps = buildSteps()
    stateMachine = LivenessStateMachine(config, steps)
    stateMachine.reset(nowMs)
    listener.onChallengeChanged(
      0,
      steps.first().label
    )
    startSessionTimeout()

    landmarker = FaceLandmarkerPipeline(context, config, this).apply { setup(modelSource) }

    val analyzer = ImageAnalysis.Analyzer { imageProxy ->
      landmarker?.processImageProxy(imageProxy, isFrontCamera)
    }

    cameraController = CameraXController(context, lifecycleOwner, analyzer, previewView)
    cameraController?.start(isFrontCamera)
  }

  fun stop() {
    captureScheduled = false
    captureActive = false
    captureAttempts = 0
    captureDelayRunnable?.let { mainHandler.removeCallbacks(it) }
    captureDelayRunnable = null
    sessionTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    sessionTimeoutRunnable = null
    landmarker?.close()
    landmarker = null
    cameraController?.stop()
    cameraController = null
    latestMetrics = null
    lastOvalState = null
  }

  override fun onResults(result: FaceLandmarkerResult, input: MPImage, timestampMs: Long) {
    val metrics = FaceMetricsExtractor.extract(result, input.width, input.height) ?: return
    latestMetrics = metrics
    listener.onFaceDetected(metrics.boundingBox)
    val currentStep = if (!captureScheduled && steps.isNotEmpty()) {
      stateMachine.currentStep()
    } else {
      null
    }
    val isHeadTurnStep = currentStep == LivenessStep.TURN_LEFT || currentStep == LivenessStep.TURN_RIGHT
    val (insideOval, ovalReason) = if (currentStep != null) {
      checkFaceInOval(metrics, isHeadTurnStep)
    } else {
      true to null
    }
    if (insideOval != lastOvalState) {
      lastOvalState = insideOval
      listener.onFaceInOval(insideOval, ovalReason)
    }

    if (captureActive) {
      attemptCapture(metrics)
      return
    }

    if (!insideOval) return

    val update = stateMachine.update(metrics, timestampMs, true)
    when (update) {
      is LivenessUpdate.StepChanged -> {
        listener.onChallengeChanged(update.stepIndex, update.stepLabel)
      }
      is LivenessUpdate.Failed -> {
        listener.onFailure(update.reason)
        stop()
      }
      LivenessUpdate.Passed -> {
        scheduleCapture()
      }
      LivenessUpdate.None -> Unit
    }
  }

  override fun onEmpty() {
    if (lastOvalState != false) {
      lastOvalState = false
      listener.onFaceInOval(false, "No face detected")
    }
  }

  override fun onError(message: String) {
    listener.onFailure(message)
    stop()
  }

  private fun scheduleCapture() {
    if (captureScheduled) return
    captureScheduled = true
    captureActive = false
    captureAttempts = 0
    listener.onChallengeChanged(-1, "Relax and look at the camera")

    val runnable = Runnable { captureActive = true }
    captureDelayRunnable = runnable
    mainHandler.postDelayed(runnable, config.captureDelayMs)
  }

  private fun attemptCapture(metrics: FaceMetrics) {
    captureAttempts++
    val headFrontal = kotlin.math.abs(metrics.yaw) <= config.captureMaxYaw &&
      kotlin.math.abs(metrics.pitch) <= config.captureMaxPitch
    val eyesOpen = if (metrics.blinkScore > 0f) {
      metrics.blinkScore < config.captureMaxBlinkScore
    } else {
      metrics.avgEar >= config.captureMinEar
    }
    val mouthClosed = if (metrics.mouthScore > 0f) {
      metrics.mouthScore < config.captureMaxMouthScore
    } else {
      metrics.mouthMar < config.captureMaxMar
    }

    if (headFrontal && eyesOpen && mouthClosed) {
      captureActive = false
      cameraController?.takePicture(
        onImage = { bytes ->
          listener.onLivenessPassed(bytes)
          stop()
        },
        onError = { error ->
          listener.onFailure(error)
          stop()
        }
      )
      return
    }

    if (captureAttempts >= config.captureMaxAttempts) {
      listener.onFailure("Please look straight at the camera with a relaxed expression.")
      stop()
    }
  }

  private fun checkFaceInOval(
    metrics: FaceMetrics,
    isHeadTurnStep: Boolean,
  ): Pair<Boolean, String?> {
    val dy = (metrics.faceCy - config.ovalCy) / config.ovalRy
    val dx = (metrics.faceCx - config.ovalCx) / config.ovalRx

    val inEllipse = if (isHeadTurnStep) {
      kotlin.math.abs(dy) <= 1f
    } else {
      dx * dx + dy * dy <= 1f
    }

    if (!inEllipse) {
      val reason = if (kotlin.math.abs(dy) >= kotlin.math.abs(dx)) {
        if (dy < 0) "Move down slightly" else "Move up slightly"
      } else {
        if (dx < 0) "Move right" else "Move left"
      }
      return false to reason
    }

    if (metrics.faceSize < config.minFaceSize) return false to "Move closer to the camera"
    if (metrics.faceSize > config.maxFaceSize) return false to "Move back a little"

    return true to null
  }

  private fun buildSteps(): List<LivenessStep> {
    val list = LivenessStep.ordered.toMutableList()
    if (config.shuffleSteps) list.shuffle()
    return list
  }

  private fun startSessionTimeout() {
    sessionTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    val runnable = Runnable {
      listener.onFailure("Timed out. Please try again.")
      stop()
    }
    sessionTimeoutRunnable = runnable
    mainHandler.postDelayed(runnable, config.sessionTimeoutMs)
  }
}
