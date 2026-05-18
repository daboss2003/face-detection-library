package com.liveness.detection

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Base64
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Full-screen liveness UI owned by the SDK. Start with [startForResult];
 * receive result in onActivityResult (RESULT_OK + [EXTRA_IMAGE_BASE64], or RESULT_CANCELED + [EXTRA_FAILURE_REASON]).
 *
 * For embedded usage (rendering the camera inside your own UI), use [LivenessView] directly
 * instead of launching this Activity.
 */
class LivenessActivity : AppCompatActivity(), LivenessListener {

  private lateinit var livenessView: LivenessView

  private var modelUrl: String? = null
  private var soundsJson: String? = null
  private var configJson: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_liveness)
    livenessView = findViewById(R.id.liveness_view)

    modelUrl = intent.getStringExtra(EXTRA_MODEL_URL) ?: ModelDownloader.DEFAULT_MODEL_URL
    soundsJson = intent.getStringExtra(EXTRA_SOUNDS_JSON)
    configJson = intent.getStringExtra(EXTRA_CONFIG_JSON)

    livenessView.modelUrl = modelUrl
    livenessView.sounds = LivenessConfigJson.parseSounds(soundsJson)
    livenessView.config = LivenessConfigJson.parse(configJson)
    livenessView.listener = this

    if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
      requestPermissions(arrayOf(android.Manifest.permission.CAMERA), REQUEST_CAMERA)
      return
    }
    livenessView.start(this)
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQUEST_CAMERA && grantResults.isNotEmpty() && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
      livenessView.start(this)
    } else {
      setFailureResult("Camera permission required")
      finish()
    }
  }

  override fun onPause() {
    livenessView.stop()
    super.onPause()
  }

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {}
  override fun onFaceInOval(inside: Boolean, reason: String?) {}
  override fun onFaceDetected(boundingBox: android.graphics.RectF?) {}

  override fun onLivenessPassed(imageBytes: ByteArray) {
    val base64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
    setResult(RESULT_OK, Intent().putExtra(EXTRA_IMAGE_BASE64, base64))
    finish()
  }

  override fun onFailure(reason: String) {
    setFailureResult(reason)
    finish()
  }

  private fun setFailureResult(reason: String) {
    setResult(RESULT_CANCELED, Intent().putExtra(EXTRA_FAILURE_REASON, reason))
  }

  companion object {
    const val EXTRA_MODEL_URL = "liveness_model_url"
    const val EXTRA_SOUNDS_JSON = "liveness_sounds_json"
    const val EXTRA_CONFIG_JSON = "liveness_config_json"
    const val EXTRA_IMAGE_BASE64 = "liveness_image_base64"
    const val EXTRA_FAILURE_REASON = "liveness_failure_reason"
    private const val REQUEST_CAMERA = 9001

    @JvmStatic
    fun startForResult(
      activity: Activity,
      requestCode: Int,
      modelUrl: String? = null,
      soundsJson: String? = null,
      configJson: String? = null,
    ) {
      val intent = Intent(activity, LivenessActivity::class.java).apply {
        modelUrl?.let { putExtra(EXTRA_MODEL_URL, it) }
        soundsJson?.let { putExtra(EXTRA_SOUNDS_JSON, it) }
        configJson?.let { putExtra(EXTRA_CONFIG_JSON, it) }
      }
      activity.startActivityForResult(intent, requestCode)
    }
  }
}
