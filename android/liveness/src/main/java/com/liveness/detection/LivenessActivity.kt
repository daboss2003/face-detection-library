package com.liveness.detection

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Base64
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject

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
    livenessView.sounds = parseSounds(soundsJson)
    livenessView.config = parseConfig(configJson)
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
      fun s(k: String, default: String): String = if (c.has(k) && !c.isNull(k)) c.optString(k, default) else default
      fun color(k: String, default: Int): Int =
        if (c.has(k) && !c.isNull(k)) {
          try { Color.parseColor(c.optString(k)) } catch (_: Exception) { default }
        } else default

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
        shape = s("shape", d.shape),
        showInstructions = b("showInstructions", d.showInstructions),
        minSizeDp = f("minSizeDp", d.minSizeDp),
        progressColor = color("progressColor", d.progressColor),
        progressErrorColor = color("progressErrorColor", d.progressErrorColor),
        progressWidthDp = f("progressWidthDp", d.progressWidthDp),
        progressLineCap = s("progressLineCap", d.progressLineCap),
        overlayColor = color("overlayColor", d.overlayColor),
        overlayErrorColor = color("overlayErrorColor", d.overlayErrorColor),
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
