import Foundation

public struct LivenessConfig {
  public var yawLeftThreshold: Float = -15
  public var yawRightThreshold: Float = 15
  public var frontalYawThreshold: Float = 10
  public var frontalPitchThreshold: Float = 10
  public var blinkOpenThreshold: Float = 0.25
  public var blinkClosedThreshold: Float = 0.18
  public var blinkMaxDurationMs: Int64 = 1000
  public var blinkTimeoutMs: Int64 = 5000
  public var stepTimeoutMs: Int64 = 10000
  public var mouthTimeoutMs: Int64 = 5000
  public var mouthOpenThreshold: Float = 0.35
  public var nodDownThreshold: Float = 15
  public var nodUpThreshold: Float = -5
  public var nodTimeoutMs: Int64 = 10000
  public var maxYawDuringBlink: Float = 20
  public var maxPitchDuringBlink: Float = 20
  public var maxYawDuringNod: Float = 20
  public var maxYawDuringMouth: Float = 20
  public var maxPitchDuringMouth: Float = 20
  public var captureDelayMs: Int64 = 400

  public var faceDetectionConfidence: Float = 0.5
  public var facePresenceConfidence: Float = 0.5
  public var faceTrackingConfidence: Float = 0.5

  public init() {}
}
