package com.liveness.reactnative

import android.util.Base64
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.liveness.detection.LivenessDetector
import com.liveness.detection.LivenessListener

class LivenessDetectionModule(
  private val reactContext: ReactApplicationContext
) : NativeLivenessDetectionSpec(reactContext), LivenessListener {
  private var detector: LivenessDetector? = null
  private var pendingPromise: Promise? = null
  private var overlayContainer: FrameLayout? = null
  private var previewView: PreviewView? = null

  override fun getName(): String = NAME

  @ReactMethod
  override fun startLiveness(promise: Promise) {
    val activity = currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "Activity not available")
      return
    }
    pendingPromise = promise
    stopInternal()

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
      startLiveness(activity, preview, true)
    }
  }

  @ReactMethod
  override fun stop() {
    stopInternal()
  }

  private fun stopInternal() {
    detector?.stop()
    detector = null
    previewView = null
    overlayContainer?.let { container ->
      (container.parent as? ViewGroup)?.removeView(container)
    }
    overlayContainer = null
    pendingPromise = null
  }

  override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
    emitEvent("challengeChanged", mapOf("stepIndex" to stepIndex, "stepLabel" to stepLabel))
  }

  override fun onLivenessPassed(imageBytes: ByteArray) {
    val promise = pendingPromise
    if (promise != null) {
      val imageBase64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
      val result = mapOf("imageBase64" to imageBase64)
      promise.resolve(result)
    }
    pendingPromise = null
    stopInternal()
  }

  override fun onFailure(reason: String) {
    emitEvent("failure", mapOf("reason" to reason))
    pendingPromise?.reject("LIVENESS_FAILED", reason)
    pendingPromise = null
    stopInternal()
  }

  private fun emitEvent(name: String, data: Map<String, Any>) {
    val emitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
    emitter.emit(name, data)
  }

  override fun addListener(eventName: String?) {
    // Required by RN for event emitter compliance.
  }

  override fun removeListeners(count: Double) {
    // Required by RN for event emitter compliance.
  }

  companion object {
    const val NAME = "LivenessDetection"
  }
}
