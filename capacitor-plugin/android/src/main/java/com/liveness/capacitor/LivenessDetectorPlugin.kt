package com.liveness.capacitor

import android.Manifest
import android.util.Base64
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.liveness.detection.LivenessDetector
import com.liveness.detection.LivenessListener
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
  private var requestedModelUrl: String? = null

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

    val modelUrl = call.getString("modelUrl")
    requestedModelUrl = modelUrl ?: ModelDownloader.DEFAULT_MODEL_URL
    downloadModelFromUrl(requestedModelUrl!!, "face_landmarker.task")
  }

  private fun startDetectorWithModel(modelPath: String) {
    val activity = bridge.activity
    val root = activity.findViewById<ViewGroup>(android.R.id.content)
    val container = FrameLayout(activity)
    container.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    val preview = PreviewView(activity)
    preview.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )

    container.addView(preview)
    root.addView(container)
    overlayContainer = container
    previewView = preview

    detector = LivenessDetector(activity, this).apply {
      startLiveness(activity, preview, true, ModelSource.FilePath(modelPath))
    }
  }

  private fun downloadModelFromUrl(url: String, fileName: String) {
    ModelDownloader.downloadIfNeeded(
      context = context,
      url = url,
      fileName = fileName,
      onSuccess = { file ->
        bridge.activity.runOnUiThread {
          startDetectorWithModel(file.absolutePath)
        }
      },
      onError = { error ->
        bridge.activity.runOnUiThread {
          onFailure(error)
        }
      }
    )
  }

  private fun stopInternal() {
    detector?.stop()
    detector = null
    previewView = null
    overlayContainer?.let { container ->
      (container.parent as? ViewGroup)?.removeView(container)
    }
    overlayContainer = null
    pendingCall = null
    requestedModelUrl = null
  }

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
    val data = JSObject()
    data.put("stepIndex", stepIndex)
    data.put("stepLabel", stepLabel)
    notifyListeners("challengeChanged", data)
  }

  override fun onLivenessPassed(imageBytes: ByteArray) {
    val call = pendingCall ?: return
    val data = JSObject()
    data.put("imageBase64", Base64.encodeToString(imageBytes, Base64.NO_WRAP))
    call.resolve(data)
    pendingCall = null
    stopInternal()
  }

  override fun onFailure(reason: String) {
    val data = JSObject()
    data.put("reason", reason)
    notifyListeners("failure", data)
    pendingCall?.reject(reason)
    pendingCall = null
    stopInternal()
  }
}
