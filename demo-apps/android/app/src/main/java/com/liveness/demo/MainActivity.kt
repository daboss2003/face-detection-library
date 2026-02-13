package com.liveness.demo

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.liveness.detection.LivenessDetector
import com.liveness.detection.LivenessListener
import com.liveness.detection.ModelDownloader
import com.liveness.detection.ModelSource

class MainActivity : AppCompatActivity(), LivenessListener {
  private lateinit var previewView: PreviewView
  private lateinit var overlayView: FaceOverlayView
  private lateinit var challengeText: TextView
  private lateinit var statusText: TextView

  private var detector: LivenessDetector? = null
  private val modelFileName = "face_landmarker.task"
  private val modelUrl = ModelDownloader.DEFAULT_MODEL_URL

  private val permissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
  ) { granted ->
    if (granted) startModelDownload() else updateStatus("Camera permission required")
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    previewView = findViewById(R.id.previewView)
    overlayView = findViewById(R.id.overlayView)
    challengeText = findViewById(R.id.challengeText)
    statusText = findViewById(R.id.statusText)
  }

  override fun onResume() {
    super.onResume()
    if (hasCameraPermission()) {
      startModelDownload()
    } else {
      permissionLauncher.launch(Manifest.permission.CAMERA)
    }
  }

  override fun onPause() {
    detector?.stop()
    detector = null
    super.onPause()
  }

  private fun startModelDownload() {
    downloadModelFromUrl()
  }

  private fun startDetector(modelPath: String) {
    detector?.stop()
    detector = LivenessDetector(this, this).apply {
      startLiveness(
        this@MainActivity,
        previewView,
        true,
        ModelSource.FilePath(modelPath)
      )
    }
    updateStatus("Running")
  }

  private fun downloadModelFromUrl() {
    runOnUiThread { updateStatus("Downloading model (HTTP)...") }
    ModelDownloader.downloadIfNeeded(
      context = this,
      url = modelUrl,
      fileName = modelFileName,
      onSuccess = { file ->
        runOnUiThread { startDetector(file.absolutePath) }
      },
      onError = { error ->
        runOnUiThread { updateStatus(error) }
      }
    )
  }

  private fun hasCameraPermission(): Boolean {
    return ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED
  }

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
    runOnUiThread {
      challengeText.text = stepLabel
      statusText.text = "Step ${stepIndex + 1} of 5"
    }
  }

  override fun onLivenessPassed(imageBytes: ByteArray) {
    runOnUiThread {
      statusText.text = "Liveness passed (${imageBytes.size} bytes)"
    }
  }

  override fun onFailure(reason: String) {
    runOnUiThread {
      statusText.text = "Failed: $reason"
    }
  }

  override fun onFaceDetected(boundingBox: android.graphics.RectF?) {
    runOnUiThread {
      overlayView.updateBoundingBox(boundingBox)
    }
  }

  private fun updateStatus(text: String) {
    statusText.text = text
  }
}
