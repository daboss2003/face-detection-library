package com.liveness.reactnative

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.liveness.detection.LivenessActivity

class LivenessDetectionModule(
  private val reactContext: ReactApplicationContext
) : NativeLivenessDetectionSpec(reactContext) {
  private var pendingPromise: Promise? = null

  private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_LIVENESS) return
      val promise = pendingPromise ?: return
      pendingPromise = null
      if (resultCode == Activity.RESULT_OK) {
        val base64 = data?.getStringExtra(LivenessActivity.EXTRA_IMAGE_BASE64) ?: ""
        promise.resolve(mapOf("imageBase64" to base64))
      } else {
        val reason = data?.getStringExtra(LivenessActivity.EXTRA_FAILURE_REASON) ?: "Liveness failed"
        promise.reject("LIVENESS_FAILED", reason)
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = NAME

  @ReactMethod
  override fun startLiveness(options: ReadableMap?, promise: Promise) {
    val activity = currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "Activity not available")
      return
    }
    pendingPromise = promise
    val modelUrl = options?.getString("modelUrl")
    val soundBaseUrl = options?.getString("soundBaseUrl")
    LivenessActivity.startForResult(activity, REQUEST_LIVENESS, modelUrl, soundBaseUrl)
  }

  @ReactMethod
  override fun stop() {
    pendingPromise = null
  }

  override fun addListener(eventName: String?) {}
  override fun removeListeners(count: Double) {}

  companion object {
    const val NAME = "LivenessDetection"
    private const val REQUEST_LIVENESS = 9001
  }
}
