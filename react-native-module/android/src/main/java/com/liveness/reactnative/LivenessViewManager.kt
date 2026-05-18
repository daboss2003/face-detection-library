package com.liveness.reactnative

import android.util.Base64
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import com.liveness.detection.LivenessConfig
import com.liveness.detection.LivenessConfigJson
import com.liveness.detection.LivenessListener
import com.liveness.detection.LivenessView
import org.json.JSONObject

/**
 * Bridges the native [LivenessView] to React Native as `<LivenessNativeView />`.
 *
 * Props: `config` (object), `sounds` (object), `modelUrl` (string), `started` (bool).
 * Events: `onChallengeChanged`, `onFaceInOval`, `onLivenessPassed`, `onLivenessFailure`.
 */
class LivenessViewManager : SimpleViewManager<LivenessView>() {

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(reactContext: ThemedReactContext): LivenessView {
    val view = LivenessView(reactContext)
    view.listener = object : LivenessListener {
      override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
        val map = Arguments.createMap().apply {
          putInt("stepIndex", stepIndex)
          putString("stepLabel", stepLabel)
        }
        sendEvent(reactContext, view.id, "onChallengeChanged", map)
      }
      override fun onFaceInOval(inside: Boolean, reason: String?) {
        val map = Arguments.createMap().apply {
          putBoolean("inside", inside)
          if (reason != null) putString("reason", reason)
        }
        sendEvent(reactContext, view.id, "onFaceInOval", map)
      }
      override fun onLivenessPassed(imageBytes: ByteArray) {
        val map = Arguments.createMap().apply {
          putString("imageBase64", Base64.encodeToString(imageBytes, Base64.NO_WRAP))
        }
        sendEvent(reactContext, view.id, "onLivenessPassed", map)
      }
      override fun onFailure(reason: String) {
        val map = Arguments.createMap().apply { putString("reason", reason) }
        sendEvent(reactContext, view.id, "onLivenessFailure", map)
      }
      override fun onFaceDetected(boundingBox: android.graphics.RectF?) {}
    }
    return view
  }

  override fun onDropViewInstance(view: LivenessView) {
    view.stop()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf(
    "onChallengeChanged" to mapOf("registrationName" to "onChallengeChanged"),
    "onFaceInOval"       to mapOf("registrationName" to "onFaceInOval"),
    "onLivenessPassed"   to mapOf("registrationName" to "onLivenessPassed"),
    "onLivenessFailure"  to mapOf("registrationName" to "onLivenessFailure"),
  )

  @ReactProp(name = "config")
  fun setConfig(view: LivenessView, configMap: ReadableMap?) {
    val cfg: LivenessConfig = if (configMap != null) {
      val json = readableMapToJson(configMap).toString()
      LivenessConfigJson.parse(json)
    } else {
      LivenessConfig()
    }
    view.config = cfg
  }

  @ReactProp(name = "sounds")
  fun setSounds(view: LivenessView, soundsMap: ReadableMap?) {
    if (soundsMap == null) {
      view.sounds = null
      return
    }
    val json = readableMapToJson(soundsMap)
    view.sounds = LivenessConfigJson.parseSoundsFromObject(json)
  }

  @ReactProp(name = "modelUrl")
  fun setModelUrl(view: LivenessView, url: String?) {
    view.modelUrl = url
  }

  @ReactProp(name = "started")
  fun setStarted(view: LivenessView, started: Boolean) {
    val ctx = view.context
    val themed = ctx as? ThemedReactContext
    val activity = themed?.currentActivity
    if (started) {
      if (activity is LifecycleOwner) {
        view.start(activity)
      }
    } else {
      view.stop()
    }
  }

  private fun sendEvent(ctx: ReactApplicationContext, viewId: Int, name: String, body: WritableMap) {
    val surfaceId = UIManagerHelper.getSurfaceId(ctx)
    UIManagerHelper.getEventDispatcherForReactTag(ctx, viewId)
      ?.dispatchEvent(object : Event<Event<*>>(surfaceId, viewId) {
        override fun getEventName() = name
        override fun getEventData(): WritableMap = body
      })
  }

  private fun readableMapToJson(map: ReadableMap): JSONObject {
    val json = JSONObject()
    val iter = map.keySetIterator()
    while (iter.hasNextKey()) {
      val key = iter.nextKey()
      when (map.getType(key)) {
        ReadableType.Null    -> json.put(key, JSONObject.NULL)
        ReadableType.Boolean -> json.put(key, map.getBoolean(key))
        ReadableType.Number  -> json.put(key, map.getDouble(key))
        ReadableType.String  -> json.put(key, map.getString(key))
        ReadableType.Map     -> map.getMap(key)?.let { json.put(key, readableMapToJson(it)) }
        ReadableType.Array   -> {}
      }
    }
    return json
  }

  companion object {
    const val REACT_CLASS = "LivenessNativeView"
  }
}
