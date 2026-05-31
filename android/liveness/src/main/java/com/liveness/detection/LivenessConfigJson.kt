package com.liveness.detection

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

/**
 * Parses a JSON config blob into a [LivenessConfig]. Unknown / malformed keys fall back to
 * defaults. Colour fields accept any string `Color.parseColor` understands (e.g. `#12c95c`,
 * `#FF12c95c`, named colours).
 *
 * Shared by [LivenessActivity], the React Native ViewManager, and the Capacitor plugin
 * so the same JSON shape works across all three.
 */
object LivenessConfigJson {
  fun parse(json: String?): LivenessConfig {
    if (json.isNullOrBlank()) return LivenessConfig()
    return try {
      parseFromObject(JSONObject(json))
    } catch (_: Exception) {
      LivenessConfig()
    }
  }

  fun parseFromObject(c: JSONObject): LivenessConfig {
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
    fun stringList(k: String, default: List<String>?): List<String>? {
      if (!c.has(k) || c.isNull(k)) return default
      val arr = c.optJSONArray(k) ?: return default
      val out = ArrayList<String>(arr.length())
      for (i in 0 until arr.length()) {
        val v = arr.opt(i) ?: continue
        if (v is String) out.add(v) else out.add(v.toString())
      }
      return out
    }

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
      blinkMinClosedMs = l("blinkMinClosedMs", d.blinkMinClosedMs),
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
      steps = stringList("steps", d.steps),
      cdnMaxRetries = i("cdnMaxRetries", d.cdnMaxRetries),
      cdnAttemptTimeoutMs = l("cdnAttemptTimeoutMs", d.cdnAttemptTimeoutMs),
      connectivityCheckTimeoutMs = l("connectivityCheckTimeoutMs", d.connectivityCheckTimeoutMs),
      shape = s("shape", d.shape),
      showInstructions = b("showInstructions", d.showInstructions),
      minSizeDp = f("minSizeDp", d.minSizeDp).let { if (c.has("minSize") && !c.has("minSizeDp")) f("minSize", d.minSizeDp) else it },
      progressColor = color("progressColor", d.progressColor),
      progressErrorColor = color("progressErrorColor", d.progressErrorColor),
      progressWidthDp = f("progressWidthDp", d.progressWidthDp).let { if (c.has("progressWidth") && !c.has("progressWidthDp")) f("progressWidth", d.progressWidthDp) else it },
      progressLineCap = s("progressLineCap", d.progressLineCap),
      overlayColor = color("overlayColor", d.overlayColor),
      overlayErrorColor = color("overlayErrorColor", d.overlayErrorColor),
    )
  }

  fun parseSounds(json: String?): LivenessSoundOptions? {
    if (json.isNullOrBlank()) return null
    return try {
      parseSoundsFromObject(JSONObject(json))
    } catch (_: Exception) {
      null
    }
  }

  fun parseSoundsFromObject(o: JSONObject): LivenessSoundOptions {
    fun str(k: String): String? {
      if (!o.has(k) || o.isNull(k)) return null
      val s = o.optString(k, "")
      return if (s.isEmpty()) null else s
    }
    return LivenessSoundOptions(
      baseUrl = str("baseUrl"),
      left = str("left"),
      blink = str("blink"),
      right = str("right"),
      nod = str("nod"),
      mouth = str("mouth"),
      good = str("good"),
      capture = str("capture"),
    )
  }
}
