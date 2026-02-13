import Foundation
import MediaPipeTasksVision

struct Pose {
  let yaw: Float
  let pitch: Float
  let roll: Float
}

enum PoseEstimator {
  static func fromTransformationMatrix(_ matrix: [Float]?) -> Pose? {
    guard let matrix = matrix, matrix.count >= 16 else { return nil }
    let r00 = matrix[0]
    let r10 = matrix[4]
    let r20 = matrix[8]
    let r21 = matrix[9]
    let r22 = matrix[10]

    let pitch = asin(-r20)
    let yaw = atan2(r10, r00)
    let roll = atan2(r21, r22)

    return Pose(
      yaw: radToDeg(yaw),
      pitch: radToDeg(pitch),
      roll: radToDeg(roll)
    )
  }

  static func fromLandmarks(_ landmarks: [NormalizedLandmark]) -> Pose {
    let leftEyeOuter = landmarks[33]
    let rightEyeOuter = landmarks[263]
    let noseTip = landmarks[1]
    let chin = landmarks[152]

    let yaw = atan2(
      rightEyeOuter.z - leftEyeOuter.z,
      rightEyeOuter.x - leftEyeOuter.x
    )
    let roll = atan2(
      rightEyeOuter.y - leftEyeOuter.y,
      rightEyeOuter.x - leftEyeOuter.x
    )
    let pitch = atan2(
      chin.y - noseTip.y,
      chin.z - noseTip.z
    )

    return Pose(
      yaw: radToDeg(yaw),
      pitch: radToDeg(pitch),
      roll: radToDeg(roll)
    )
  }

  private static func radToDeg(_ value: Float) -> Float {
    return value * 180 / Float.pi
  }
}
