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

    let categories = result.faceBlendshapes.first?.categories ?? []
    func blendScore(_ name: String) -> Float {
      return categories.first(where: { $0.categoryName == name })?.score ?? 0
    }
    let blinkL = blendScore("eyeBlinkLeft")
    let blinkR = blendScore("eyeBlinkRight")
    let blinkScore = (blinkL > 0 || blinkR > 0) ? (blinkL + blinkR) / 2 : 0
    let mouthScore = blendScore("jawOpen")

    var sumX: Float = 0
    var sumY: Float = 0
    for lm in landmarks {
      sumX += lm.x
      sumY += lm.y
    }
    let faceCx = sumX / Float(landmarks.count)
    let faceCy = sumY / Float(landmarks.count)
    let faceSize = distance(landmarks[33], landmarks[263])

    return FaceMetrics(
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll,
      leftEar: leftEar,
      rightEar: rightEar,
      mouthMar: mar,
      blinkScore: blinkScore,
      mouthScore: mouthScore,
      faceCx: faceCx,
      faceCy: faceCy,
      faceSize: faceSize,
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

  private static func distance(_ a: NormalizedLandmark, _ b: NormalizedLandmark) -> Float {
    let dx = a.x - b.x
    let dy = a.y - b.y
    return sqrt(dx * dx + dy * dy)
  }
}
