package com.liveness.capacitor

import android.util.Base64
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import androidx.camera.view.PreviewView
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import android.Manifest
import com.getcapacitor.PermissionState
import com.liveness.detection.LivenessConfig
import com.liveness.detection.LivenessDetector
import com.liveness.detection.LivenessHintView
import com.liveness.detection.LivenessListener
import com.liveness.detection.LivenessOvalOverlayView
import com.liveness.detection.LivenessSoundOptions
import com.liveness.detection.ModelDownloader
import com.liveness.detection.ModelSource

@CapacitorPlugin(
  name = "LivenessDetector",
  permissions = [
    Permission(strings = [Manifest.permission.CAMERA], alias = "camera")
  ]
)
class LivenessDetectorPlugin : Plugin(), LivenessListener {
  private var detector: LivenessDetector? = null
  private var pendingCall: PluginCall? = null
  private var overlayContainer: FrameLayout? = null
  private var previewView: PreviewView? = null
  private var overlayView: LivenessOvalOverlayView? = null
  private var instructionText: TextView? = null
  private var posHintText: TextView? = null
  private var hintView: LivenessHintView? = null

  @PluginMethod
  fun startLiveness(call: PluginCall) {
    if (getPermissionState("camera") != PermissionState.GRANTED) {
      pendingCall = call
      requestPermissionForAlias("camera", call, "cameraPermsCallback")
      return
    }
    startInternal(call)
  }

  @PluginMethod
  fun stop(call: PluginCall) {
    stopInternal()
    call.resolve()
  }

  @PermissionCallback
  fun cameraPermsCallback(call: PluginCall) {
    if (getPermissionState("camera") == PermissionState.GRANTED) {
      startInternal(call)
    } else {
      call.reject("Camera permission denied")
    }
  }

  private fun startInternal(call: PluginCall) {
    stopInternal()
    pendingCall = call
    val act = activity ?: run {
      call.reject("Activity not available")
      return
    }
    val modelUrl = call.getString("modelUrl") ?: ModelDownloader.DEFAULT_MODEL_URL
    val config = parseConfig(call)
    ModelDownloader.downloadIfNeeded(
      context = context,
      url = modelUrl,
      fileName = "face_landmarker.task",
      maxAttempts = config.cdnMaxRetries,
      attemptTimeoutMs = config.cdnAttemptTimeoutMs.toInt(),
      connectivityCheckTimeoutMs = config.connectivityCheckTimeoutMs.toInt(),
      onSuccess = { file ->
        act.runOnUiThread { startDetectorWithModel(act, file.absolutePath, call, config) }
      },
      onError = { error ->
        act.runOnUiThread {
          pendingCall?.reject(error)
          pendingCall = null
        }
      }
    )
  }

  private fun parseSounds(call: PluginCall): LivenessSoundOptions? {
    val nested = call.getObject("sounds")
    if (nested != null) {
      return LivenessSoundOptions(
        baseUrl = nested.optString("baseUrl", null as String?),
        left = nested.optString("left", null as String?),
        blink = nested.optString("blink", null as String?),
        right = nested.optString("right", null as String?),
        nod = nested.optString("nod", null as String?),
        mouth = nested.optString("mouth", null as String?),
        good = nested.optString("good", null as String?),
        capture = nested.optString("capture", null as String?),
      )
    }
    return call.getString("soundBaseUrl")?.let { LivenessSoundOptions(baseUrl = it) }
  }

  private fun parseConfig(call: PluginCall): LivenessConfig {
    val c = call.getObject("config") ?: return LivenessConfig()
    val d = LivenessConfig()
    fun f(k: String, default: Float): Float = if (c.has(k)) c.optDouble(k, default.toDouble()).toFloat() else default
    fun l(k: String, default: Long): Long = if (c.has(k)) c.optLong(k, default) else default
    fun i(k: String, default: Int): Int = if (c.has(k)) c.optInt(k, default) else default
    fun b(k: String, default: Boolean): Boolean = if (c.has(k)) c.optBoolean(k, default) else default
    return LivenessConfig(
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
  }

  private fun startDetectorWithModel(act: android.app.Activity, modelPath: String, call: PluginCall, config: LivenessConfig) {
    val root = act.findViewById<ViewGroup>(android.R.id.content)
    val container = FrameLayout(act).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }
    val preview = PreviewView(act).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }
    val overlay = LivenessOvalOverlayView(act).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }
    val instruction = TextView(act).apply {
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 17f
      setPadding(0, (180 * act.resources.displayMetrics.density).toInt(), 0, 0)
    }
    val posHint = TextView(act).apply {
      setTextColor(0xffff3b3b.toInt())
      textSize = 13f
      visibility = android.view.View.GONE
    }
    val hintSize = (52 * act.resources.displayMetrics.density).toInt()
    val hintTop = (180 * act.resources.displayMetrics.density).toInt()
    val hint = LivenessHintView(act).apply {
      layoutParams = FrameLayout.LayoutParams(hintSize, hintSize).apply { topMargin = hintTop }
    }

    container.addView(preview)
    container.addView(overlay)
    container.addView(instruction)
    container.addView(posHint)
    container.addView(hint)
    root.addView(container)

    overlayContainer = container
    previewView = preview
    overlayView = overlay
    instructionText = instruction
    posHintText = posHint
    hintView = hint

    val sounds = parseSounds(call)
    detector = LivenessDetector(act, this, config, sounds).apply {
      startLiveness(act, preview, true, ModelSource.FilePath(modelPath))
    }
  }

  private fun stopInternal() {
    detector?.stop()
    detector = null
    previewView = null
    overlayView = null
    instructionText = null
    posHintText = null
    hintView = null
    overlayContainer?.let { container ->
      (container.parent as? ViewGroup)?.removeView(container)
    }
    overlayContainer = null
    pendingCall = null
  }

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
    activity?.runOnUiThread {
      instructionText?.text = stepLabel
      if (stepIndex >= 0) {
        overlayView?.setProgress(stepIndex)
        overlayView?.setStepDots(stepIndex)
        hintView?.setHint(stepLabel)
      } else {
        overlayView?.setProgress(5)
        overlayView?.setStepDots(5)
        hintView?.setHint(null)
      }
    }
    notifyListeners("challengeChanged", JSObject().put("stepIndex", stepIndex).put("stepLabel", stepLabel))
  }

  override fun onFaceInOval(inside: Boolean, reason: String?) {
    activity?.runOnUiThread {
      overlayView?.setFaceInOval(inside)
      posHintText?.visibility = if (inside) android.view.View.GONE else android.view.View.VISIBLE
      posHintText?.text = reason ?: ""
    }
    val data = JSObject().put("inside", inside)
    reason?.let { data.put("reason", it) }
    notifyListeners("faceInOval", data)
  }

  override fun onLivenessPassed(imageBytes: ByteArray) {
    val call = pendingCall ?: return
    call.resolve(JSObject().put("imageBase64", Base64.encodeToString(imageBytes, Base64.NO_WRAP)))
    stopInternal()
  }

  override fun onFailure(reason: String) {
    notifyListeners("failure", JSObject().put("reason", reason))
    pendingCall?.reject(reason)
    stopInternal()
  }
}
