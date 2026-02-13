import Foundation

enum LivenessUpdate {
  case none
  case stepChanged(LivenessStep)
  case failed(String)
  case passed
}

final class LivenessStateMachine {
  private let config: LivenessConfig
  private var stepIndex: Int = 0
  private var stepStartMs: Int64 = 0
  private var blinkState: BlinkState = .waitingForOpen
  private var nodState: NodState = .waitingForDown

  init(config: LivenessConfig) {
    self.config = config
  }

  func reset(nowMs: Int64) {
    stepIndex = 0
    stepStartMs = nowMs
    blinkState = .waitingForOpen
    nodState = .waitingForDown
  }

  func currentStep() -> LivenessStep {
    return LivenessStep.allCases[stepIndex]
  }

  func update(metrics: FaceMetrics, nowMs: Int64) -> LivenessUpdate {
    let elapsed = nowMs - stepStartMs
    let step = currentStep()
    let timeout: Int64
    switch step {
    case .blink:
      timeout = config.blinkTimeoutMs
    case .mouth:
      timeout = config.mouthTimeoutMs
    case .nod:
      timeout = config.nodTimeoutMs
    default:
      timeout = config.stepTimeoutMs
    }

    if elapsed > timeout {
      return .failed("Step timeout")
    }

    switch step {
    case .turnLeft:
      return handleTurnLeft(metrics: metrics, nowMs: nowMs)
    case .blink:
      return handleBlink(metrics: metrics, elapsedMs: elapsed, nowMs: nowMs)
    case .turnRight:
      return handleTurnRight(metrics: metrics, nowMs: nowMs)
    case .nod:
      return handleNod(metrics: metrics, nowMs: nowMs)
    case .mouth:
      return handleMouth(metrics: metrics, nowMs: nowMs)
    }
  }

  private func handleTurnLeft(metrics: FaceMetrics, nowMs: Int64) -> LivenessUpdate {
    if metrics.yaw > config.yawRightThreshold {
      return .failed("Wrong direction: turned right")
    }
    if metrics.yaw < config.yawLeftThreshold {
      return advanceStep(nowMs: nowMs)
    }
    return .none
  }

  private func handleTurnRight(metrics: FaceMetrics, nowMs: Int64) -> LivenessUpdate {
    if metrics.yaw < config.yawLeftThreshold {
      return .failed("Wrong direction: turned left")
    }
    if metrics.yaw > config.yawRightThreshold {
      return advanceStep(nowMs: nowMs)
    }
    return .none
  }

  private func handleBlink(metrics: FaceMetrics, elapsedMs: Int64, nowMs: Int64) -> LivenessUpdate {
    if abs(metrics.yaw) > config.maxYawDuringBlink ||
      abs(metrics.pitch) > config.maxPitchDuringBlink {
      return .failed("Incorrect motion during blink")
    }

    switch blinkState {
    case .waitingForOpen:
      if metrics.avgEar > config.blinkOpenThreshold {
        blinkState = .waitingForClosed
      }
    case .waitingForClosed:
      if metrics.avgEar < config.blinkClosedThreshold {
        blinkState = .waitingForOpenAgain
      }
    case .waitingForOpenAgain:
      if metrics.avgEar > config.blinkOpenThreshold {
        if elapsedMs <= config.blinkMaxDurationMs {
          return advanceStep(nowMs: nowMs)
        }
        return .failed("Blink too slow")
      }
    }
    return .none
  }

  private func handleNod(metrics: FaceMetrics, nowMs: Int64) -> LivenessUpdate {
    if abs(metrics.yaw) > config.maxYawDuringNod {
      return .failed("Incorrect motion during nod")
    }
    switch nodState {
    case .waitingForDown:
      if metrics.pitch > config.nodDownThreshold {
        nodState = .waitingForUp
      }
    case .waitingForUp:
      if metrics.pitch < config.nodUpThreshold {
        return advanceStep(nowMs: nowMs)
      }
    }
    return .none
  }

  private func handleMouth(metrics: FaceMetrics, nowMs: Int64) -> LivenessUpdate {
    if abs(metrics.yaw) > config.maxYawDuringMouth ||
      abs(metrics.pitch) > config.maxPitchDuringMouth {
      return .failed("Incorrect motion during mouth step")
    }
    if metrics.mouthMar > config.mouthOpenThreshold {
      return advanceStep(nowMs: nowMs)
    }
    return .none
  }

  private func advanceStep(nowMs: Int64) -> LivenessUpdate {
    stepIndex += 1
    if stepIndex >= LivenessStep.allCases.count {
      return .passed
    }
    stepStartMs = nowMs
    blinkState = .waitingForOpen
    nodState = .waitingForDown
    return .stepChanged(currentStep())
  }

  private enum BlinkState {
    case waitingForOpen
    case waitingForClosed
    case waitingForOpenAgain
  }

  private enum NodState {
    case waitingForDown
    case waitingForUp
  }
}
