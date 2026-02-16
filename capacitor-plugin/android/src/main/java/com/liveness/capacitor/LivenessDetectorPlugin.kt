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
    ModelDownloader.downloadIfNeeded(
      context = context,
      url = modelUrl,
      fileName = "face_landmarker.task",
      onSuccess = { file ->
        act.runOnUiThread { startDetectorWithModel(act, file.absolutePath, call) }
      },
      onError = { error ->
        act.runOnUiThread {
          pendingCall?.reject(error)
          pendingCall = null
        }
      }
    )
  }

  private fun startDetectorWithModel(act: android.app.Activity, modelPath: String, call: PluginCall) {
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

    val soundBaseUrl = call.getString("soundBaseUrl")
    val sounds = soundBaseUrl?.let { LivenessSoundOptions(baseUrl = it) }
    detector = LivenessDetector(act, this, LivenessConfig(), sounds).apply {
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
