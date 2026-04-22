package com.liveness.reactnative

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.liveness.detection.LivenessActivity
import org.json.JSONObject

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

    val soundsJson = when {
      options?.hasKey("sounds") == true && options.getType("sounds") == ReadableType.Map ->
        options.getMap("sounds")?.let { readableMapToJson(it).toString() }
      options?.hasKey("soundBaseUrl") == true ->
        JSONObject().put("baseUrl", options.getString("soundBaseUrl")).toString()
      else -> null
    }

    val configJson = if (options?.hasKey("config") == true && options.getType("config") == ReadableType.Map) {
      options.getMap("config")?.let { readableMapToJson(it).toString() }
    } else null

    LivenessActivity.startForResult(activity, REQUEST_LIVENESS, modelUrl, soundsJson, configJson)
  }

  @ReactMethod
  override fun stop() {
    pendingPromise = null
  }

  override fun addListener(eventName: String?) {}
  override fun removeListeners(count: Double) {}

  private fun readableMapToJson(map: ReadableMap): JSONObject {
    val json = JSONObject()
    val iter = map.keySetIterator()
    while (iter.hasNextKey()) {
      val key = iter.nextKey()
      when (map.getType(key)) {
        ReadableType.Null -> json.put(key, JSONObject.NULL)
        ReadableType.Boolean -> json.put(key, map.getBoolean(key))
        ReadableType.Number -> json.put(key, map.getDouble(key))
        ReadableType.String -> json.put(key, map.getString(key))
        ReadableType.Map -> map.getMap(key)?.let { json.put(key, readableMapToJson(it)) }
        ReadableType.Array -> {}
      }
    }
    return json
  }

  companion object {
    const val NAME = "LivenessDetection"
    private const val REQUEST_LIVENESS = 9001
  }
}
