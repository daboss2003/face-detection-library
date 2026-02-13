import Foundation
import CoreGraphics
import MediaPipeTasksVision

enum FaceMetricsExtractor {
  static func extract(result: FaceLandmarkerResult, imageSize: CGSize) -> FaceMetrics? {
    guard let landmarks = result.faceLandmarks.first else { return nil }

    let (leftEar, rightEar) = EyeMouthMetrics.computeEar(landmarks)
    let mar = EyeMouthMetrics.computeMar(landmarks)

    let pose = PoseEstimator.fromTransformationMatrix(
      TransformationMatrixExtractor.extract(from: result)
    ) ?? PoseEstimator.fromLandmarks(landmarks)

    let boundingBox = computeBoundingBox(landmarks, imageSize: imageSize)

    return FaceMetrics(
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll,
      leftEar: leftEar,
      rightEar: rightEar,
      mouthMar: mar,
      boundingBox: boundingBox,
      timestampMs: Int64(result.timestampInMilliseconds)
    )
  }

  private static func computeBoundingBox(_ landmarks: [NormalizedLandmark], imageSize: CGSize) -> CGRect {
    var minX: Float = 1
    var minY: Float = 1
    var maxX: Float = 0
    var maxY: Float = 0
    for lm in landmarks {
      minX = min(minX, lm.x)
      minY = min(minY, lm.y)
      maxX = max(maxX, lm.x)
      maxY = max(maxY, lm.y)
    }
    return CGRect(
      x: CGFloat(minX) * imageSize.width,
      y: CGFloat(minY) * imageSize.height,
      width: CGFloat(maxX - minX) * imageSize.width,
      height: CGFloat(maxY - minY) * imageSize.height
    )
  }
}
