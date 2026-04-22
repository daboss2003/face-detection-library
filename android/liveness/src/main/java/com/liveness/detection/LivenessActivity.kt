package com.liveness.detection

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import org.json.JSONObject

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
  private var soundsJson: String? = null
  private var configJson: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_liveness)
    previewView = findViewById(R.id.liveness_preview)
    overlayView = findViewById(R.id.liveness_overlay)
    instructionText = findViewById(R.id.liveness_instruction)
    posHintText = findViewById(R.id.liveness_pos_hint)
    hintView = findViewById(R.id.liveness_hint)

    modelUrl = intent.getStringExtra(EXTRA_MODEL_URL) ?: ModelDownloader.DEFAULT_MODEL_URL
    soundsJson = intent.getStringExtra(EXTRA_SOUNDS_JSON)
    configJson = intent.getStringExtra(EXTRA_CONFIG_JSON)

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
    val sounds = parseSounds(soundsJson)
    val config = parseConfig(configJson)
    val url = modelUrl ?: ModelDownloader.DEFAULT_MODEL_URL
    instructionText.text = "Downloading model..."
    ModelDownloader.downloadIfNeeded(
      context = this,
      url = url,
      fileName = "face_landmarker.task",
      maxAttempts = config.cdnMaxRetries,
      attemptTimeoutMs = config.cdnAttemptTimeoutMs.toInt(),
      connectivityCheckTimeoutMs = config.connectivityCheckTimeoutMs.toInt(),
      onSuccess = { file ->
        runOnUiThread {
          instructionText.text = "Position your face in the oval"
          detector = LivenessDetector(this, this, config, sounds).apply {
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

  private fun parseSounds(json: String?): LivenessSoundOptions? {
    if (json.isNullOrBlank()) return null
    return try {
      val o = JSONObject(json)
      LivenessSoundOptions(
        baseUrl = o.optStringOrNull("baseUrl"),
        left = o.optStringOrNull("left"),
        blink = o.optStringOrNull("blink"),
        right = o.optStringOrNull("right"),
        nod = o.optStringOrNull("nod"),
        mouth = o.optStringOrNull("mouth"),
        good = o.optStringOrNull("good"),
        capture = o.optStringOrNull("capture"),
      )
    } catch (_: Exception) { null }
  }

  private fun parseConfig(json: String?): LivenessConfig {
    if (json.isNullOrBlank()) return LivenessConfig()
    return try {
      val c = JSONObject(json)
      val d = LivenessConfig()
      fun f(k: String, default: Float): Float = if (c.has(k)) c.optDouble(k, default.toDouble()).toFloat() else default
      fun l(k: String, default: Long): Long = if (c.has(k)) c.optLong(k, default) else default
      fun i(k: String, default: Int): Int = if (c.has(k)) c.optInt(k, default) else default
      fun b(k: String, default: Boolean): Boolean = if (c.has(k)) c.optBoolean(k, default) else default
      LivenessConfig(
        readyMs = l("readyMs", d.readyMs),
        sessionTimeoutMs = l("sessionTimeoutMs", d.sessionTimeoutMs),
        baselineFrames = i("baselineFrames", d.baselineFrames),
        yawTurnDelta = f("yawTurnDelta", d.yawTurnDelta),
        yawWrongDirDelta = f("yawWrongDirDelta", d.yawWrongDirDelta),
        headTurnHoldMs = l("headTurnHoldMs", d.headTurnHoldMs),
        nodDownDelta = f("nodDownDelta", d.nodDownDelta),
        nodReturnFraction = f("nodReturnFraction", d.nodReturnFraction),
        nodReturnMaxDelta = f("nodReturnMaxDelta", d.nodReturnMaxDelta),
        blinkClosedThreshold = f("blinkClosedThreshold", d.blinkClosedThreshold),
        blinkOpenThreshold = f("blinkOpenThreshold", d.blinkOpenThreshold),
        earClosedThreshold = f("earClosedThreshold", d.earClosedThreshold),
        earOpenThreshold = f("earOpenThreshold", d.earOpenThreshold),
        blinkMaxDurationMs = l("blinkMaxDurationMs", d.blinkMaxDurationMs),
        mouthOpenThreshold = f("mouthOpenThreshold", d.mouthOpenThreshold),
        mouthOpenMarThreshold = f("mouthOpenMarThreshold", d.mouthOpenMarThreshold),
        mouthHoldMs = l("mouthHoldMs", d.mouthHoldMs),
        maxYawDuringBlink = f("maxYawDuringBlink", d.maxYawDuringBlink),
        maxPitchDuringBlink = f("maxPitchDuringBlink", d.maxPitchDuringBlink),
        maxYawDuringNod = f("maxYawDuringNod", d.maxYawDuringNod),
        maxYawDuringMouth = f("maxYawDuringMouth", d.maxYawDuringMouth),
        maxPitchDuringMouth = f("maxPitchDuringMouth", d.maxPitchDuringMouth),
        ovalCx = f("ovalCx", d.ovalCx),
        ovalCy = f("ovalCy", d.ovalCy),
        ovalRx = f("ovalRx", d.ovalRx),
        ovalRy = f("ovalRy", d.ovalRy),
        minFaceSize = f("minFaceSize", d.minFaceSize),
        maxFaceSize = f("maxFaceSize", d.maxFaceSize),
        captureDelayMs = l("captureDelayMs", d.captureDelayMs),
        captureMaxAttempts = i("captureMaxAttempts", d.captureMaxAttempts),
        captureMaxYaw = f("captureMaxYaw", d.captureMaxYaw),
        captureMaxPitch = f("captureMaxPitch", d.captureMaxPitch),
        captureMaxMouthScore = f("captureMaxMouthScore", d.captureMaxMouthScore),
        captureMaxBlinkScore = f("captureMaxBlinkScore", d.captureMaxBlinkScore),
        captureMinEar = f("captureMinEar", d.captureMinEar),
        captureMaxMar = f("captureMaxMar", d.captureMaxMar),
        shuffleSteps = b("shuffleSteps", d.shuffleSteps),
        cdnMaxRetries = i("cdnMaxRetries", d.cdnMaxRetries),
        cdnAttemptTimeoutMs = l("cdnAttemptTimeoutMs", d.cdnAttemptTimeoutMs),
        connectivityCheckTimeoutMs = l("connectivityCheckTimeoutMs", d.connectivityCheckTimeoutMs),
      )
    } catch (_: Exception) { LivenessConfig() }
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

private fun JSONObject.optStringOrNull(key: String): String? {
  if (!has(key) || isNull(key)) return null
  val s = optString(key, "")
  return if (s.isEmpty()) null else s
}
