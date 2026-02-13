package com.liveness.detection

class LivenessStateMachine(
  private val config: LivenessConfig,
) {
  private var stepIndex = 0
  private var stepStartMs: Long = 0L
  private var blinkState = BlinkState.WAITING_FOR_OPEN
  private var nodState = NodState.WAITING_FOR_DOWN

  fun reset(nowMs: Long) {
    stepIndex = 0
    stepStartMs = nowMs
    blinkState = BlinkState.WAITING_FOR_OPEN
    nodState = NodState.WAITING_FOR_DOWN
  }

  fun currentStep(): LivenessStep {
    return LivenessStep.ordered[stepIndex]
  }

  fun update(metrics: FaceMetrics, nowMs: Long): LivenessUpdate {
    val elapsed = nowMs - stepStartMs
    val step = currentStep()

    val timeout = when (step) {
      LivenessStep.BLINK -> config.blinkTimeoutMs
      LivenessStep.MOUTH -> config.mouthTimeoutMs
      LivenessStep.NOD -> config.nodTimeoutMs
      else -> config.stepTimeoutMs
    }

    if (elapsed > timeout) {
      return LivenessUpdate.Failed("Step timeout")
    }

    return when (step) {
      LivenessStep.TURN_LEFT -> handleTurnLeft(metrics, nowMs)
      LivenessStep.BLINK -> handleBlink(metrics, elapsed, nowMs)
      LivenessStep.TURN_RIGHT -> handleTurnRight(metrics, nowMs)
      LivenessStep.NOD -> handleNod(metrics, nowMs)
      LivenessStep.MOUTH -> handleMouth(metrics, nowMs)
    }
  }

  private fun handleTurnLeft(metrics: FaceMetrics, nowMs: Long): LivenessUpdate {
    if (metrics.yaw > config.yawRightThreshold) {
      return LivenessUpdate.Failed("Wrong direction: turned right")
    }
    if (metrics.yaw < config.yawLeftThreshold) {
      return advanceStep(nowMs)
    }
    return LivenessUpdate.None
  }

  private fun handleTurnRight(metrics: FaceMetrics, nowMs: Long): LivenessUpdate {
    if (metrics.yaw < config.yawLeftThreshold) {
      return LivenessUpdate.Failed("Wrong direction: turned left")
    }
    if (metrics.yaw > config.yawRightThreshold) {
      return advanceStep(nowMs)
    }
    return LivenessUpdate.None
  }

  private fun handleBlink(metrics: FaceMetrics, elapsedMs: Long, nowMs: Long): LivenessUpdate {
    if (kotlin.math.abs(metrics.yaw) > config.maxYawDuringBlink ||
      kotlin.math.abs(metrics.pitch) > config.maxPitchDuringBlink) {
      return LivenessUpdate.Failed("Incorrect motion during blink")
    }

    when (blinkState) {
      BlinkState.WAITING_FOR_OPEN -> {
        if (metrics.avgEar > config.blinkOpenThreshold) {
          blinkState = BlinkState.WAITING_FOR_CLOSED
        }
      }
      BlinkState.WAITING_FOR_CLOSED -> {
        if (metrics.avgEar < config.blinkClosedThreshold) {
          blinkState = BlinkState.WAITING_FOR_OPEN_AGAIN
        }
      }
      BlinkState.WAITING_FOR_OPEN_AGAIN -> {
        if (metrics.avgEar > config.blinkOpenThreshold) {
          if (elapsedMs <= config.blinkMaxDurationMs) {
            return advanceStep(nowMs)
          }
          return LivenessUpdate.Failed("Blink too slow")
        }
      }
    }
    return LivenessUpdate.None
  }

  private fun handleNod(metrics: FaceMetrics, nowMs: Long): LivenessUpdate {
    if (kotlin.math.abs(metrics.yaw) > config.maxYawDuringNod) {
      return LivenessUpdate.Failed("Incorrect motion during nod")
    }
    when (nodState) {
      NodState.WAITING_FOR_DOWN -> {
        if (metrics.pitch > config.nodDownThreshold) {
          nodState = NodState.WAITING_FOR_UP
        }
      }
      NodState.WAITING_FOR_UP -> {
        if (metrics.pitch < config.nodUpThreshold) {
          return advanceStep(nowMs)
        }
      }
    }
    return LivenessUpdate.None
  }

  private fun handleMouth(metrics: FaceMetrics, nowMs: Long): LivenessUpdate {
    if (kotlin.math.abs(metrics.yaw) > config.maxYawDuringMouth ||
      kotlin.math.abs(metrics.pitch) > config.maxPitchDuringMouth) {
      return LivenessUpdate.Failed("Incorrect motion during mouth step")
    }
    if (metrics.mouthMar > config.mouthOpenThreshold) {
      return advanceStep(nowMs)
    }
    return LivenessUpdate.None
  }

  private fun advanceStep(nowMs: Long): LivenessUpdate {
    stepIndex++
    if (stepIndex >= LivenessStep.ordered.size) {
      return LivenessUpdate.Passed
    }
    stepStartMs = nowMs
    blinkState = BlinkState.WAITING_FOR_OPEN
    nodState = NodState.WAITING_FOR_DOWN
    val step = currentStep()
    return LivenessUpdate.StepChanged(step)
  }

  private enum class BlinkState {
    WAITING_FOR_OPEN,
    WAITING_FOR_CLOSED,
    WAITING_FOR_OPEN_AGAIN,
  }

  private enum class NodState {
    WAITING_FOR_DOWN,
    WAITING_FOR_UP,
  }
}

sealed class LivenessUpdate {
  data class StepChanged(val step: LivenessStep) : LivenessUpdate()
  data class Failed(val reason: String) : LivenessUpdate()
  data object Passed : LivenessUpdate()
  data object None : LivenessUpdate()
}
