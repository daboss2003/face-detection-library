package com.liveness.detection

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner

class CameraXController(
  private val context: Context,
  private val lifecycleOwner: LifecycleOwner,
  private val analyzer: ImageAnalysis.Analyzer,
  private val previewView: PreviewView?,
) {
  private var cameraProvider: ProcessCameraProvider? = null
  private var imageCapture: ImageCapture? = null

  fun start(isFrontCamera: Boolean) {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
    cameraProviderFuture.addListener({
      cameraProvider = cameraProviderFuture.get()
      bindUseCases(isFrontCamera)
    }, ContextCompat.getMainExecutor(context))
  }

  private fun bindUseCases(isFrontCamera: Boolean) {
    val provider = cameraProvider ?: return
    provider.unbindAll()

    val cameraSelector = CameraSelector.Builder()
      .requireLensFacing(if (isFrontCamera) {
        CameraSelector.LENS_FACING_FRONT
      } else {
        CameraSelector.LENS_FACING_BACK
      })
      .build()

    val preview = Preview.Builder().build()
    previewView?.surfaceProvider?.let { preview.setSurfaceProvider(it) }

    val analysis = ImageAnalysis.Builder()
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
      .build()
    analysis.setAnalyzer(ContextCompat.getMainExecutor(context), analyzer)

    imageCapture = ImageCapture.Builder()
      .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
      .build()

    provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, analysis, imageCapture)
  }

  fun takePicture(
    onImage: (ByteArray) -> Unit,
    onError: (String) -> Unit,
  ) {
    val capture = imageCapture ?: run {
      onError("ImageCapture not initialized")
      return
    }
    capture.takePicture(
      ContextCompat.getMainExecutor(context),
      object : ImageCapture.OnImageCapturedCallback() {
        override fun onCaptureSuccess(image: androidx.camera.core.ImageProxy) {
          try {
            val bytes = ImageUtils.imageProxyToJpeg(image)
            onImage(bytes)
          } catch (e: Exception) {
            onError("Capture conversion failed: ${e.message}")
          } finally {
            image.close()
          }
        }

        override fun onError(exception: ImageCaptureException) {
          onError(exception.message ?: "Capture failed")
        }
      }
    )
  }

  fun stop() {
    cameraProvider?.unbindAll()
  }
}
