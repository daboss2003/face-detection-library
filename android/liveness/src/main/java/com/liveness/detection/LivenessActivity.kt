package com.liveness.detection

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat

/**
 * Full-screen liveness UI owned by the SDK. Start with [startForResult];
 * receive result in onActivityResult (RESULT_OK + [EXTRA_IMAGE_BASE64], or RESULT_CANCELED + [EXTRA_FAILURE_REASON]).
 */
class LivenessActivity : AppCompatActivity(), LivenessListener {

  private lateinit var previewView: PreviewView
  private lateinit var overlayView: LivenessOvalOverlayView
  private lateinit var instructionText: TextView
  private lateinit var posHintText: TextView
  private lateinit var hintView: LivenessHintView

  private var detector: LivenessDetector? = null
  private var modelUrl: String? = null
  private var soundBaseUrl: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_liveness)
    previewView = findViewById(R.id.liveness_preview)
    overlayView = findViewById(R.id.liveness_overlay)
    instructionText = findViewById(R.id.liveness_instruction)
    posHintText = findViewById(R.id.liveness_pos_hint)
    hintView = findViewById(R.id.liveness_hint)

    modelUrl = intent.getStringExtra(EXTRA_MODEL_URL) ?: ModelDownloader.DEFAULT_MODEL_URL
    soundBaseUrl = intent.getStringExtra(EXTRA_SOUND_BASE_URL)

    if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
      requestPermissions(arrayOf(android.Manifest.permission.CAMERA), REQUEST_CAMERA)
      return
    }
    startDetection()
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQUEST_CAMERA && grantResults.isNotEmpty() && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
      startDetection()
    } else {
      setFailureResult("Camera permission required")
      finish()
    }
  }

  private fun startDetection() {
    val sounds = soundBaseUrl?.let { LivenessSoundOptions(baseUrl = it) }
    val url = modelUrl ?: ModelDownloader.DEFAULT_MODEL_URL
    instructionText.text = "Downloading model..."
    ModelDownloader.downloadIfNeeded(
      context = this,
      url = url,
      fileName = "face_landmarker.task",
      onSuccess = { file ->
        runOnUiThread {
          instructionText.text = "Position your face in the oval"
          detector = LivenessDetector(this, this, LivenessConfig(), sounds).apply {
            startLiveness(this@LivenessActivity, previewView, true, ModelSource.FilePath(file.absolutePath))
          }
        }
      },
      onError = { error ->
        runOnUiThread {
          setFailureResult(error)
          finish()
        }
      }
    )
  }

  override fun onPause() {
    detector?.stop()
    detector = null
    super.onPause()
  }

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
    runOnUiThread {
      instructionText.text = stepLabel
      if (stepIndex >= 0) {
        overlayView.setProgress(stepIndex)
        overlayView.setStepDots(stepIndex)
        hintView.setHint(stepLabel)
      } else {
        overlayView.setProgress(5)
        overlayView.setStepDots(5)
        hintView.setHint(null)
      }
    }
  }

  override fun onFaceInOval(inside: Boolean, reason: String?) {
    runOnUiThread {
      overlayView.setFaceInOval(inside)
      posHintText.visibility = if (inside) View.GONE else View.VISIBLE
      posHintText.text = reason ?: ""
    }
  }

  override fun onLivenessPassed(imageBytes: ByteArray) {
    runOnUiThread {
      val base64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
      setResult(RESULT_OK, Intent().putExtra(EXTRA_IMAGE_BASE64, base64))
      finish()
    }
  }

  override fun onFailure(reason: String) {
    runOnUiThread {
      setFailureResult(reason)
      finish()
    }
  }

  override fun onFaceDetected(boundingBox: android.graphics.RectF?) {}

  private fun setFailureResult(reason: String) {
    setResult(RESULT_CANCELED, Intent().putExtra(EXTRA_FAILURE_REASON, reason))
  }

  companion object {
    const val EXTRA_MODEL_URL = "liveness_model_url"
    const val EXTRA_SOUND_BASE_URL = "liveness_sound_base_url"
    const val EXTRA_IMAGE_BASE64 = "liveness_image_base64"
    const val EXTRA_FAILURE_REASON = "liveness_failure_reason"
    private const val REQUEST_CAMERA = 9001

    @JvmStatic
    fun startForResult(activity: Activity, requestCode: Int, modelUrl: String? = null, soundBaseUrl: String? = null) {
      val intent = Intent(activity, LivenessActivity::class.java).apply {
        modelUrl?.let { putExtra(EXTRA_MODEL_URL, it) }
        soundBaseUrl?.let { putExtra(EXTRA_SOUND_BASE_URL, it) }
      }
      activity.startActivityForResult(intent, requestCode)
    }
  }
}
