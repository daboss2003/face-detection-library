package com.liveness.capacitor

import android.Manifest
import android.util.Base64
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.lifecycle.LifecycleOwner
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.liveness.detection.LivenessConfig
import com.liveness.detection.LivenessConfigJson
import com.liveness.detection.LivenessListener
import com.liveness.detection.LivenessSoundOptions
import com.liveness.detection.LivenessView

@CapacitorPlugin(
  name = "LivenessDetector",
  permissions = [
    Permission(strings = [Manifest.permission.CAMERA], alias = "camera")
  ]
)
class LivenessDetectorPlugin : Plugin(), LivenessListener {
  private var pendingCall: PluginCall? = null
  private var livenessView: LivenessView? = null

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
    val config = parseConfig(call)
    val sounds: LivenessSoundOptions? = call.getObject("sounds")?.let {
      LivenessConfigJson.parseSoundsFromObject(it)
    } ?: call.getString("soundBaseUrl")?.let { LivenessSoundOptions(baseUrl = it) }
    val modelUrl = call.getString("modelUrl")

    act.runOnUiThread {
      val view = LivenessView(act).apply {
        layoutParams = FrameLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT,
        )
        this.config = config
        this.sounds = sounds
        this.modelUrl = modelUrl
        this.listener = this@LivenessDetectorPlugin
      }
      val root = act.findViewById<ViewGroup>(android.R.id.content)
      root.addView(view)
      livenessView = view
      view.start(act as LifecycleOwner)
    }
  }

  private fun parseConfig(call: PluginCall): LivenessConfig {
    val c = call.getObject("config") ?: return LivenessConfig()
    return LivenessConfigJson.parseFromObject(c)
  }

  private fun stopInternal() {
    livenessView?.let { view ->
      view.stop()
      (view.parent as? ViewGroup)?.removeView(view)
    }
    livenessView = null
    pendingCall = null
  }

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
    notifyListeners("challengeChanged", JSObject().put("stepIndex", stepIndex).put("stepLabel", stepLabel))
  }

  override fun onFaceInOval(inside: Boolean, reason: String?) {
    val data = JSObject().put("inside", inside)
    reason?.let { data.put("reason", it) }
    notifyListeners("faceInOval", data)
  }

  override fun onLivenessPassed(imageBytes: ByteArray) {
    val call = pendingCall ?: return
    call.resolve(JSObject().put("imageBase64", Base64.encodeToString(imageBytes, Base64.NO_WRAP)))
    activity?.runOnUiThread { stopInternal() }
  }

  override fun onFailure(reason: String) {
    notifyListeners("failure", JSObject().put("reason", reason))
    pendingCall?.reject(reason)
    activity?.runOnUiThread { stopInternal() }
  }

  override fun onFaceDetected(boundingBox: android.graphics.RectF?) {}
}
