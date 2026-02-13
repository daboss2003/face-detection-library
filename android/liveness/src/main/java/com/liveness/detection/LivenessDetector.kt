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
  private var stateMachine = LivenessStateMachine(config)
  private val mainHandler = Handler(Looper.getMainLooper())
  private var latestMetrics: FaceMetrics? = null
  private var captureScheduled = false

  fun startLiveness(
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView?,
    isFrontCamera: Boolean = true,
    modelSource: ModelSource = ModelSource.Asset("face_landmarker.task"),
  ) {
    stop()
    val nowMs = System.currentTimeMillis()
    stateMachine.reset(nowMs)
    listener.onChallengeChanged(
      LivenessStep.ordered.first().index,
      LivenessStep.ordered.first().label
    )

    landmarker = FaceLandmarkerPipeline(context, config, this).apply { setup(modelSource) }

    val analyzer = ImageAnalysis.Analyzer { imageProxy ->
      landmarker?.processImageProxy(imageProxy, isFrontCamera)
    }

    cameraController = CameraXController(context, lifecycleOwner, analyzer, previewView)
    cameraController?.start(isFrontCamera)
  }

  fun stop() {
    captureScheduled = false
    landmarker?.close()
    landmarker = null
    cameraController?.stop()
    cameraController = null
    latestMetrics = null
  }

  override fun onResults(result: FaceLandmarkerResult, input: MPImage, timestampMs: Long) {
    val metrics = FaceMetricsExtractor.extract(result, input.width, input.height) ?: return
    latestMetrics = metrics
    listener.onFaceDetected(metrics.boundingBox)
    val update = stateMachine.update(metrics, timestampMs)
    when (update) {
      is LivenessUpdate.StepChanged -> {
        listener.onChallengeChanged(update.step.index, update.step.label)
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
    // Ignore empty frames; timeouts are handled in state machine.
  }

  override fun onError(message: String) {
    listener.onFailure(message)
    stop()
  }

  private fun scheduleCapture() {
    if (captureScheduled) return
    captureScheduled = true
    mainHandler.postDelayed({
      val metrics = latestMetrics
      if (metrics == null) {
        listener.onFailure("No face available for capture")
        stop()
        return@postDelayed
      }

      if (kotlin.math.abs(metrics.yaw) > config.frontalYawThreshold ||
        kotlin.math.abs(metrics.pitch) > config.frontalPitchThreshold ||
        metrics.avgEar < config.blinkOpenThreshold) {
        listener.onFailure("Final check failed (frontal + eyes open required)")
        stop()
        return@postDelayed
      }

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
    }, config.captureDelayMs)
  }
}
