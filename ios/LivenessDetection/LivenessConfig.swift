import Foundation

@objc public final class LivenessConfig: NSObject {
  @objc public var readyMs: Int64 = 1800
  @objc public var sessionTimeoutMs: Int64 = 120000
  @objc public var baselineFrames: Int = 8
  @objc public var yawTurnDelta: Float = 9
  @objc public var yawWrongDirDelta: Float = 16
  @objc public var headTurnHoldMs: Int64 = 80
  @objc public var nodDownDelta: Float = 3
  @objc public var nodReturnFraction: Float = 0.85
  @objc public var nodReturnMaxDelta: Float = 12
  @objc public var blinkClosedThreshold: Float = 0.30
  @objc public var blinkOpenThreshold: Float = 0.25
  @objc public var earClosedThreshold: Float = 0.20
  @objc public var earOpenThreshold: Float = 0.25
  @objc public var blinkMaxDurationMs: Int64 = 4000
  @objc public var mouthOpenThreshold: Float = 0.20
  @objc public var mouthOpenMarThreshold: Float = 0.20
  @objc public var mouthHoldMs: Int64 = 50
  @objc public var maxYawDuringBlink: Float = 30
  @objc public var maxPitchDuringBlink: Float = 30
  @objc public var maxYawDuringNod: Float = 40
  @objc public var maxYawDuringMouth: Float = 35
  @objc public var maxPitchDuringMouth: Float = 35
  @objc public var ovalCx: Float = 0.50
  @objc public var ovalCy: Float = 0.42
  @objc public var ovalRx: Float = 0.32
  @objc public var ovalRy: Float = 0.40
  @objc public var minFaceSize: Float = 0.10
  @objc public var maxFaceSize: Float = 0.62
  @objc public var captureDelayMs: Int64 = 700
  @objc public var captureMaxAttempts: Int = 90
  @objc public var captureMaxYaw: Float = 18
  @objc public var captureMaxPitch: Float = 18
  @objc public var captureMaxMouthScore: Float = 0.20
  @objc public var captureMaxBlinkScore: Float = 0.25
  @objc public var captureMinEar: Float = 0.22
  @objc public var captureMaxMar: Float = 0.22
  @objc public var shuffleSteps: Bool = true

  @objc public var faceDetectionConfidence: Float = 0.5
  @objc public var facePresenceConfidence: Float = 0.5
  @objc public var faceTrackingConfidence: Float = 0.5

  @objc public var cdnMaxRetries: Int = 5
  @objc public var cdnAttemptTimeoutMs: Int64 = 45000
  @objc public var connectivityCheckTimeoutMs: Int64 = 5000

  @objc public override init() {
    super.init()
  }
}
