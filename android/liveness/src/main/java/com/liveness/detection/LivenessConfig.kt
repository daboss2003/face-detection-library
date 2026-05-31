package com.liveness.detection

import android.graphics.Color

data class LivenessConfig(
  val readyMs: Long = 1800L,
  val sessionTimeoutMs: Long = 120000L,
  val baselineFrames: Int = 8,
  val yawTurnDelta: Float = 9f,
  val yawWrongDirDelta: Float = 16f,
  val headTurnHoldMs: Long = 80L,
  val nodDownDelta: Float = 3f,
  val nodReturnFraction: Float = 0.85f,
  val nodReturnMaxDelta: Float = 12f,
  // Real blinks easily hit 0.7+. Sustained squinting / glare / hooded eyelids hover at 0.25–0.40 —
  // keep the "closed" threshold well above that band so passive eye states don't latch CLOSED.
  val blinkClosedThreshold: Float = 0.50f,
  val blinkOpenThreshold: Float = 0.25f,
  val earClosedThreshold: Float = 0.20f,
  val earOpenThreshold: Float = 0.25f,
  /** Eyes must be CLOSED for at least this long before a blink counts — filters out single-frame noise. */
  val blinkMinClosedMs: Long = 60L,
  val blinkMaxDurationMs: Long = 4000L,
  val mouthOpenThreshold: Float = 0.20f,
  val mouthOpenMarThreshold: Float = 0.20f,
  val mouthHoldMs: Long = 50L,
  val maxYawDuringBlink: Float = 30f,
  val maxPitchDuringBlink: Float = 30f,
  val maxYawDuringNod: Float = 40f,
  val maxYawDuringMouth: Float = 35f,
  val maxPitchDuringMouth: Float = 35f,
  val ovalCx: Float = 0.50f,
  val ovalCy: Float = 0.42f,
  val ovalRx: Float = 0.32f,
  val ovalRy: Float = 0.40f,
  val minFaceSize: Float = 0.10f,
  val maxFaceSize: Float = 0.62f,
  val captureDelayMs: Long = 700L,
  val captureMaxAttempts: Int = 90,
  val captureMaxYaw: Float = 18f,
  val captureMaxPitch: Float = 18f,
  val captureMaxMouthScore: Float = 0.20f,
  val captureMaxBlinkScore: Float = 0.25f,
  val captureMinEar: Float = 0.22f,
  val captureMaxMar: Float = 0.22f,
  val shuffleSteps: Boolean = true,
  /**
   * Subset of challenges to run, e.g. `listOf("nod", "blink", "mouth")`. Keys are
   * `"left"`, `"blink"`, `"right"`, `"nod"`, `"mouth"`. `null` or empty = all 5.
   * Unknown keys are dropped; duplicates de-duped. See [LivenessStep.resolve].
   */
  val steps: List<String>? = null,
  val faceDetectionConfidence: Float = 0.5f,
  val facePresenceConfidence: Float = 0.5f,
  val faceTrackingConfidence: Float = 0.5f,
  val cdnMaxRetries: Int = 5,
  val cdnAttemptTimeoutMs: Long = 45000L,
  val connectivityCheckTimeoutMs: Long = 5000L,

  // ── UI: shape, theme, layout (mirrors @daboss2003/liveness-web options) ───
  /** "oval" (default) or "circle". */
  val shape: String = "oval",
  /** When false, SDK-rendered instruction text, position hint, gesture icon and step dots are hidden. Sounds still play. */
  val showInstructions: Boolean = true,
  /** Minimum diameter (dp) of the visible face frame, so it stays usable on small screens. 0 = no floor. */
  val minSizeDp: Float = 220f,
  /** Ring stroke colour while face is in position. */
  val progressColor: Int = Color.parseColor("#12c95c"),
  /** Ring stroke colour while face is out of position. */
  val progressErrorColor: Int = Color.parseColor("#ff3b3b"),
  /** Ring stroke width in dp. */
  val progressWidthDp: Float = 3.5f,
  /** "round", "square" or "butt". */
  val progressLineCap: String = "round",
  /** Mask fill colour outside the cutout while face is in position. ARGB int. */
  val overlayColor: Int = 0xD1000000.toInt(),
  /** Mask fill colour outside the cutout while face is out of position. */
  val overlayErrorColor: Int = 0x8C000000.toInt(),
)
