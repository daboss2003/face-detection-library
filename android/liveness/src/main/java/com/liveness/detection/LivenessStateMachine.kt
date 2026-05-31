package com.liveness.detection

class LivenessStateMachine(
  private val config: LivenessConfig,
  private val steps: List<LivenessStep>,
) {
  private var stepIndex = 0
  private var stepStartMs: Long = 0L
  private var blinkState = BlinkState.WAITING_FOR_CLOSE
  private var blinkCloseMs: Long = 0L
  // Gate: must observe at least one isEyeOpen frame before allowing a `closed` transition.
  private var blinkSeenOpen = false
  private var nodState = NodState.NEUTRAL
  private var holdStartMs: Long? = null

  private var baselineYaw: Float? = null
  private var baselinePitch: Float? = null
  private val baselineSamples = ArrayList<Pair<Float, Float>>()
  private var nodPeakDPitch: Float = 0f

  fun reset(nowMs: Long) {
    stepIndex = 0
    stepStartMs = nowMs + config.readyMs
    resetStepState()
  }

  fun currentStep(): LivenessStep = steps[stepIndex]

  fun update(metrics: FaceMetrics, nowMs: Long, insideOval: Boolean): LivenessUpdate {
    if (insideOval && baselineYaw == null) {
      baselineSamples.add(metrics.yaw to metrics.pitch)
      if (baselineSamples.size >= config.baselineFrames) {
        val yaws = baselineSamples.map { it.first }.sorted()
        val pitches = baselineSamples.map { it.second }.sorted()
        val mid = yaws.size / 2
        baselineYaw = yaws[mid]
        baselinePitch = pitches[mid]
      }
    }

    if (nowMs < stepStartMs) return LivenessUpdate.None
    val bYaw = baselineYaw ?: return LivenessUpdate.None
    val bPitch = baselinePitch ?: return LivenessUpdate.None

    val dYaw = metrics.yaw - bYaw
    val dPitch = metrics.pitch - bPitch

    return when (currentStep()) {
      LivenessStep.TURN_LEFT -> handleTurnLeft(dYaw, nowMs)
      LivenessStep.BLINK -> handleBlink(metrics, nowMs)
      LivenessStep.TURN_RIGHT -> handleTurnRight(dYaw, nowMs)
      LivenessStep.NOD -> handleNod(dYaw, dPitch, nowMs)
      LivenessStep.MOUTH -> handleMouth(metrics, nowMs)
    }
  }

  private fun handleTurnLeft(dYaw: Float, nowMs: Long): LivenessUpdate {
    if (dYaw > config.yawWrongDirDelta) {
      holdStartMs = null
      return LivenessUpdate.None
    }
    if (dYaw < -config.yawTurnDelta) {
      if (holdStartMs == null) holdStartMs = nowMs
      if (nowMs - (holdStartMs ?: nowMs) >= config.headTurnHoldMs) return advanceStep(nowMs)
    } else {
      holdStartMs = null
    }
    return LivenessUpdate.None
  }

  private fun handleTurnRight(dYaw: Float, nowMs: Long): LivenessUpdate {
    if (dYaw < -config.yawWrongDirDelta) {
      holdStartMs = null
      return LivenessUpdate.None
    }
    if (dYaw > config.yawTurnDelta) {
      if (holdStartMs == null) holdStartMs = nowMs
      if (nowMs - (holdStartMs ?: nowMs) >= config.headTurnHoldMs) return advanceStep(nowMs)
    } else {
      holdStartMs = null
    }
    return LivenessUpdate.None
  }

  private fun handleBlink(metrics: FaceMetrics, nowMs: Long): LivenessUpdate {
    if (kotlin.math.abs(metrics.yaw) > config.maxYawDuringBlink ||
      kotlin.math.abs(metrics.pitch) > config.maxPitchDuringBlink) {
      return LivenessUpdate.None
    }

    val useBlend = metrics.blinkScore > 0f
    val isEyeClosed = if (useBlend) {
      metrics.blinkScore > config.blinkClosedThreshold
    } else {
      metrics.avgEar < config.earClosedThreshold
    }
    val isEyeOpen = if (useBlend) {
      metrics.blinkScore < config.blinkOpenThreshold
    } else {
      metrics.avgEar > config.earOpenThreshold
    }

    // Confirm eyes were OPEN before we count any closed → open transition.
    // Kills the "step starts mid-blink / mid-squint" false positive.
    if (isEyeOpen) blinkSeenOpen = true

    when (blinkState) {
      BlinkState.WAITING_FOR_CLOSE -> {
        if (isEyeClosed && blinkSeenOpen) {
          blinkState = BlinkState.CLOSED
          blinkCloseMs = nowMs
        }
      }
      BlinkState.CLOSED -> {
        if (isEyeOpen) {
          val dt = nowMs - blinkCloseMs
          if (dt in config.blinkMinClosedMs..config.blinkMaxDurationMs) {
            return advanceStep(nowMs)
          }
          // Closed phase too short (noise) or too long (eyes never reopened in time) — discard, wait for next attempt.
          // blinkSeenOpen stays true — we've already confirmed the user can open their eyes.
          blinkState = BlinkState.WAITING_FOR_CLOSE
        }
      }
    }
    return LivenessUpdate.None
  }

  private fun handleNod(dYaw: Float, dPitch: Float, nowMs: Long): LivenessUpdate {
    if (kotlin.math.abs(dYaw) > config.maxYawDuringNod) return LivenessUpdate.None
    when (nodState) {
      NodState.NEUTRAL -> {
        if (dPitch > config.nodDownDelta) {
          nodState = NodState.DOWN
          nodPeakDPitch = dPitch
        }
      }
      NodState.DOWN -> {
        if (dPitch > nodPeakDPitch) nodPeakDPitch = dPitch
        val returnTarget = minOf(
          nodPeakDPitch * config.nodReturnFraction,
          config.nodReturnMaxDelta
        )
        if (dPitch < returnTarget) return advanceStep(nowMs)
      }
    }
    return LivenessUpdate.None
  }

  private fun handleMouth(metrics: FaceMetrics, nowMs: Long): LivenessUpdate {
    if (kotlin.math.abs(metrics.yaw) > config.maxYawDuringMouth ||
      kotlin.math.abs(metrics.pitch) > config.maxPitchDuringMouth) {
      return LivenessUpdate.None
    }
    val mouthOpen = if (metrics.mouthScore > 0f) {
      metrics.mouthScore > config.mouthOpenThreshold
    } else {
      metrics.mouthMar > config.mouthOpenMarThreshold
    }
    if (mouthOpen) {
      if (holdStartMs == null) holdStartMs = nowMs
      if (nowMs - (holdStartMs ?: nowMs) >= config.mouthHoldMs) return advanceStep(nowMs)
    } else {
      holdStartMs = null
    }
    return LivenessUpdate.None
  }

  private fun advanceStep(nowMs: Long): LivenessUpdate {
    stepIndex++
    if (stepIndex >= steps.size) {
      return LivenessUpdate.Passed
    }
    stepStartMs = nowMs + config.readyMs
    resetStepState()
    return LivenessUpdate.StepChanged(stepIndex, currentStep().label)
  }

  private fun resetStepState() {
    blinkState = BlinkState.WAITING_FOR_CLOSE
    blinkCloseMs = 0L
    blinkSeenOpen = false
    nodState = NodState.NEUTRAL
    holdStartMs = null
    baselineYaw = null
    baselinePitch = null
    baselineSamples.clear()
    nodPeakDPitch = 0f
  }

  private enum class BlinkState {
    WAITING_FOR_CLOSE,
    CLOSED,
  }

  private enum class NodState {
    NEUTRAL,
    DOWN,
  }
}

sealed class LivenessUpdate {
  data class StepChanged(val stepIndex: Int, val stepLabel: String) : LivenessUpdate()
  data class Failed(val reason: String) : LivenessUpdate()
  data object Passed : LivenessUpdate()
  data object None : LivenessUpdate()
}
