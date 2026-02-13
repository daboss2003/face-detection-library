package com.liveness.detection

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import androidx.camera.core.ImageProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult

class FaceLandmarkerPipeline(
  private val context: Context,
  private val config: LivenessConfig,
  private val listener: Listener,
) {
  private var faceLandmarker: FaceLandmarker? = null

  interface Listener {
    fun onResults(result: FaceLandmarkerResult, input: MPImage, timestampMs: Long)
    fun onEmpty()
    fun onError(message: String)
  }

  fun setup(modelSource: ModelSource = ModelSource.Asset(MODEL_ASSET)) {
    val baseOptionsBuilder = BaseOptions.builder()
      .setDelegate(Delegate.CPU)

    when (modelSource) {
      is ModelSource.Asset -> baseOptionsBuilder.setModelAssetPath(modelSource.assetPath)
      is ModelSource.FilePath -> {
        val buffer = try {
          ModelSourceReader.readFileAsByteBuffer(modelSource.filePath)
        } catch (e: Exception) {
          listener.onError("Model file read failed: ${e.message}")
          return
        }
        baseOptionsBuilder.setModelAssetBuffer(buffer)
      }
    }

    val baseOptions = baseOptionsBuilder.build()

    val options = FaceLandmarker.FaceLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setMinFaceDetectionConfidence(config.faceDetectionConfidence)
      .setMinFacePresenceConfidence(config.facePresenceConfidence)
      .setMinTrackingConfidence(config.faceTrackingConfidence)
      .setNumFaces(1)
      .setOutputFaceBlendshapes(true)
      .setOutputFacialTransformationMatrixes(true)
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setResultListener(this::onLiveStreamResult)
      .setErrorListener { error ->
        listener.onError(error.message ?: "FaceLandmarker error")
      }
      .build()

    faceLandmarker = FaceLandmarker.createFromOptions(context, options)
  }

  fun close() {
    faceLandmarker?.close()
    faceLandmarker = null
  }

  fun processImageProxy(imageProxy: ImageProxy, isFrontCamera: Boolean) {
    val frameTime = SystemClock.uptimeMillis()

    val bitmapBuffer = Bitmap.createBitmap(
      imageProxy.width,
      imageProxy.height,
      Bitmap.Config.ARGB_8888
    )
    imageProxy.use { proxy ->
      bitmapBuffer.copyPixelsFromBuffer(proxy.planes[0].buffer)
    }

    val matrix = Matrix().apply {
      postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
      if (isFrontCamera) {
        postScale(-1f, 1f, imageProxy.width.toFloat(), imageProxy.height.toFloat())
      }
    }
    val rotatedBitmap = Bitmap.createBitmap(
      bitmapBuffer,
      0,
      0,
      bitmapBuffer.width,
      bitmapBuffer.height,
      matrix,
      true
    )

    val mpImage = BitmapImageBuilder(rotatedBitmap).build()
    faceLandmarker?.detectAsync(mpImage, frameTime)
  }

  private fun onLiveStreamResult(result: FaceLandmarkerResult, input: MPImage) {
    if (result.faceLandmarks().isNotEmpty()) {
      listener.onResults(result, input, result.timestampMs())
    } else {
      listener.onEmpty()
    }
  }

  companion object {
    private const val MODEL_ASSET = "face_landmarker.task"
  }
}
