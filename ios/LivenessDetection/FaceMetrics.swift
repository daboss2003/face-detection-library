import Foundation
import CoreGraphics

struct FaceMetrics {
  let yaw: Float
  let pitch: Float
  let roll: Float
  let leftEar: Float
  let rightEar: Float
  let mouthMar: Float
  let boundingBox: CGRect?
  let timestampMs: Int64

  var avgEar: Float {
    return (leftEar + rightEar) / 2.0
  }
}
