import Foundation

enum LivenessUpdate {
  case none
  case stepChanged(stepIndex: Int, stepLabel: String)
  case failed(String)
  case passed
}

final class LivenessStateMachine {
  private let config: LivenessConfig
  private let steps: [LivenessStep]
  private var stepIndex: Int = 0
  private var stepStartMs: Int64 = 0
  private var blinkState: BlinkState = .waitingForClose
  private var blinkCloseMs: Int64 = 0
  private var nodState: NodState = .neutral
  private var holdStartMs: Int64?

  private var baselineYaw: Float?
  private var baselinePitch: Float?
  private var baselineSamples: [(Float, Float)] = []
  private var nodPeakDPitch: Float = 0

  init(config: LivenessConfig, steps: [LivenessStep]) {
    self.config = config
    self.steps = steps
  }

  func reset(nowMs: Int64) {
    stepIndex = 0
    stepStartMs = nowMs + config.readyMs
    resetStepState()
  }

  func currentStep() -> LivenessStep {
    return steps[stepIndex]
  }

  func update(metrics: FaceMetrics, nowMs: Int64, insideOval: Bool) -> LivenessUpdate {
    if insideOval && baselineYaw == nil {
      baselineSamples.append((metrics.yaw, metrics.pitch))
      if baselineSamples.count >= config.baselineFrames {
        let yaws = baselineSamples.map { $0.0 }.sorted()
        let pitches = baselineSamples.map { $0.1 }.sorted()
        let mid = yaws.count / 2
        baselineYaw = yaws[mid]
        baselinePitch = pitches[mid]
      }
    }

    if nowMs < stepStartMs { return .none }
    guard let bYaw = baselineYaw, let bPitch = baselinePitch else { return .none }
    let dYaw = metrics.yaw - bYaw
    let dPitch = metrics.pitch - bPitch

    switch currentStep() {
    case .turnLeft:
      return handleTurnLeft(dYaw: dYaw, nowMs: nowMs)
    case .blink:
      return handleBlink(metrics: metrics, nowMs: nowMs)
    case .turnRight:
      return handleTurnRight(dYaw: dYaw, nowMs: nowMs)
    case .nod:
      return handleNod(dYaw: dYaw, dPitch: dPitch, nowMs: nowMs)
    case .mouth:
      return handleMouth(metrics: metrics, nowMs: nowMs)
    }
  }

  private func handleTurnLeft(dYaw: Float, nowMs: Int64) -> LivenessUpdate {
    if dYaw > config.yawWrongDirDelta {
      holdStartMs = nil
      return .none
    }
    if dYaw < -config.yawTurnDelta {
      if holdStartMs == nil { holdStartMs = nowMs }
      if nowMs - (holdStartMs ?? nowMs) >= config.headTurnHoldMs {
        return advanceStep(nowMs: nowMs)
      }
    } else {
      holdStartMs = nil
    }
    return .none
  }

  private func handleTurnRight(dYaw: Float, nowMs: Int64) -> LivenessUpdate {
    if dYaw < -config.yawWrongDirDelta {
      holdStartMs = nil
      return .none
    }
    if dYaw > config.yawTurnDelta {
      if holdStartMs == nil { holdStartMs = nowMs }
      if nowMs - (holdStartMs ?? nowMs) >= config.headTurnHoldMs {
        return advanceStep(nowMs: nowMs)
      }
    } else {
      holdStartMs = nil
    }
    return .none
  }

  private func handleBlink(metrics: FaceMetrics, nowMs: Int64) -> LivenessUpdate {
    if abs(metrics.yaw) > config.maxYawDuringBlink ||
      abs(metrics.pitch) > config.maxPitchDuringBlink {
      return .none
    }

    let useBlend = metrics.blinkScore > 0
    let isEyeClosed = useBlend
      ? metrics.blinkScore > config.blinkClosedThreshold
      : metrics.avgEar < config.earClosedThreshold
    let isEyeOpen = useBlend
      ? metrics.blinkScore < config.blinkOpenThreshold
      : metrics.avgEar > config.earOpenThreshold

    switch blinkState {
    case .waitingForClose:
      if isEyeClosed {
        blinkState = .closed
        blinkCloseMs = nowMs
      }
    case .closed:
      if isEyeOpen {
        if nowMs - blinkCloseMs <= config.blinkMaxDurationMs {
          return advanceStep(nowMs: nowMs)
        }
        blinkState = .waitingForClose
      }
    }
    return .none
  }

  private func handleNod(dYaw: Float, dPitch: Float, nowMs: Int64) -> LivenessUpdate {
    if abs(dYaw) > config.maxYawDuringNod { return .none }
    switch nodState {
    case .neutral:
      if dPitch > config.nodDownDelta {
        nodState = .down
        nodPeakDPitch = dPitch
      }
    case .down:
      if dPitch > nodPeakDPitch { nodPeakDPitch = dPitch }
      let returnTarget = min(
        nodPeakDPitch * config.nodReturnFraction,
        config.nodReturnMaxDelta
      )
      if dPitch < returnTarget { return advanceStep(nowMs: nowMs) }
    }
    return .none
  }

  private func handleMouth(metrics: FaceMetrics, nowMs: Int64) -> LivenessUpdate {
    if abs(metrics.yaw) > config.maxYawDuringMouth ||
      abs(metrics.pitch) > config.maxPitchDuringMouth {
      return .none
    }
    let mouthOpen = metrics.mouthScore > 0
      ? metrics.mouthScore > config.mouthOpenThreshold
      : metrics.mouthMar > config.mouthOpenMarThreshold
    if mouthOpen {
      if holdStartMs == nil { holdStartMs = nowMs }
      if nowMs - (holdStartMs ?? nowMs) >= config.mouthHoldMs {
        return advanceStep(nowMs: nowMs)
      }
    } else {
      holdStartMs = nil
    }
    return .none
  }

  private func advanceStep(nowMs: Int64) -> LivenessUpdate {
    stepIndex += 1
    if stepIndex >= steps.count {
      return .passed
    }
    stepStartMs = nowMs + config.readyMs
    resetStepState()
    return .stepChanged(stepIndex: stepIndex, stepLabel: currentStep().label)
  }

  private func resetStepState() {
    blinkState = .waitingForClose
    blinkCloseMs = 0
    nodState = .neutral
    holdStartMs = nil
    baselineYaw = nil
    baselinePitch = nil
    baselineSamples.removeAll()
    nodPeakDPitch = 0
  }

  private enum BlinkState {
    case waitingForClose
    case closed
  }

  private enum NodState {
    case neutral
    case down
  }
}
