package com.liveness.capacitor

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import android.Manifest
import com.getcapacitor.PermissionState
import com.liveness.detection.LivenessActivity

@CapacitorPlugin(
  name = "LivenessDetector",
  permissions = [
    Permission(strings = [Manifest.permission.CAMERA], alias = "camera")
  ]
)
class LivenessDetectorPlugin : Plugin() {

  @PluginMethod
  fun startLiveness(call: PluginCall) {
    if (getPermissionState("camera") != PermissionState.GRANTED) {
      requestPermissionForAlias("camera", call, "cameraPermsCallback")
      return
    }
    startInternal(call)
  }

  @PluginMethod
  fun stop(call: PluginCall) {
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
    val act = activity ?: run {
      call.reject("Activity not available")
      return
    }
    val modelUrl = call.getString("modelUrl")
    val soundBaseUrl = call.getString("soundBaseUrl")
    val intent = Intent(act, LivenessActivity::class.java).apply {
      modelUrl?.let { putExtra(LivenessActivity.EXTRA_MODEL_URL, it) }
      soundBaseUrl?.let { putExtra(LivenessActivity.EXTRA_SOUND_BASE_URL, it) }
    }
    startActivityForResult(call, intent, "livenessResult")
  }

  @ActivityCallback
  private fun livenessResult(call: PluginCall, result: ActivityResult) {
    if (call == null) return
    val resultCode = result.resultCode
    val data = result.data
    if (resultCode == Activity.RESULT_OK) {
      val base64 = data?.getStringExtra(LivenessActivity.EXTRA_IMAGE_BASE64) ?: ""
      call.resolve(JSObject().put("imageBase64", base64))
    } else {
      val reason = data?.getStringExtra(LivenessActivity.EXTRA_FAILURE_REASON) ?: "Liveness failed"
      notifyListeners("failure", JSObject().put("reason", reason))
      call.reject(reason)
    }
  }
}
