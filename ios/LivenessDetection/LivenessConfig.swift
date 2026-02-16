import Foundation

public struct LivenessConfig {
  public var readyMs: Int64 = 1800
  public var sessionTimeoutMs: Int64 = 120000
  public var baselineFrames: Int = 8
  public var yawTurnDelta: Float = 12
  public var yawWrongDirDelta: Float = 16
  public var headTurnHoldMs: Int64 = 120
  public var nodDownDelta: Float = 8
  public var nodReturnFraction: Float = 0.40
  public var nodReturnMaxDelta: Float = 5
  public var blinkClosedThreshold: Float = 0.35
  public var blinkOpenThreshold: Float = 0.20
  public var earClosedThreshold: Float = 0.20
  public var earOpenThreshold: Float = 0.25
  public var blinkMaxDurationMs: Int64 = 4000
  public var mouthOpenThreshold: Float = 0.28
  public var mouthOpenMarThreshold: Float = 0.28
  public var mouthHoldMs: Int64 = 120
  public var maxYawDuringBlink: Float = 25
  public var maxPitchDuringBlink: Float = 25
  public var maxYawDuringNod: Float = 22
  public var maxYawDuringMouth: Float = 25
  public var maxPitchDuringMouth: Float = 25
  public var ovalCx: Float = 0.50
  public var ovalCy: Float = 0.42
  public var ovalRx: Float = 0.32
  public var ovalRy: Float = 0.40
  public var minFaceSize: Float = 0.10
  public var maxFaceSize: Float = 0.62
  public var captureDelayMs: Int64 = 700
  public var captureMaxAttempts: Int = 90
  public var captureMaxYaw: Float = 18
  public var captureMaxPitch: Float = 18
  public var captureMaxMouthScore: Float = 0.20
  public var captureMaxBlinkScore: Float = 0.25
  public var captureMinEar: Float = 0.22
  public var captureMaxMar: Float = 0.22
  public var shuffleSteps: Bool = true
  public var yawLeftThreshold: Float = -15
  public var yawRightThreshold: Float = 15
  public var frontalYawThreshold: Float = 10
  public var frontalPitchThreshold: Float = 10
  public var blinkTimeoutMs: Int64 = 5000
  public var stepTimeoutMs: Int64 = 10000
  public var mouthTimeoutMs: Int64 = 5000
  public var nodDownThreshold: Float = 15
  public var nodUpThreshold: Float = -5
  public var nodTimeoutMs: Int64 = 10000

  public var faceDetectionConfidence: Float = 0.5
  public var facePresenceConfidence: Float = 0.5
  public var faceTrackingConfidence: Float = 0.5

  public init() {}
}
