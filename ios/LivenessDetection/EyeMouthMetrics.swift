import Foundation
import MediaPipeTasksVision

enum EyeMouthMetrics {
  private static let leftEyeOuter = 33
  private static let leftEyeInner = 133
  private static let leftEyeTop1 = 160
  private static let leftEyeTop2 = 158
  private static let leftEyeBottom1 = 153
  private static let leftEyeBottom2 = 144

  private static let rightEyeOuter = 362
  private static let rightEyeInner = 263
  private static let rightEyeTop1 = 385
  private static let rightEyeTop2 = 387
  private static let rightEyeBottom1 = 373
  private static let rightEyeBottom2 = 380

  private static let mouthLeft = 61
  private static let mouthRight = 291
  private static let mouthUpper = 13
  private static let mouthLower = 14

  static func computeEar(_ landmarks: [NormalizedLandmark]) -> (Float, Float) {
    let left = ear(
      outer: landmarks[leftEyeOuter],
      inner: landmarks[leftEyeInner],
      top1: landmarks[leftEyeTop1],
      top2: landmarks[leftEyeTop2],
      bottom1: landmarks[leftEyeBottom1],
      bottom2: landmarks[leftEyeBottom2]
    )
    let right = ear(
      outer: landmarks[rightEyeOuter],
      inner: landmarks[rightEyeInner],
      top1: landmarks[rightEyeTop1],
      top2: landmarks[rightEyeTop2],
      bottom1: landmarks[rightEyeBottom1],
      bottom2: landmarks[rightEyeBottom2]
    )
    return (left, right)
  }

  static func computeMar(_ landmarks: [NormalizedLandmark]) -> Float {
    let left = landmarks[mouthLeft]
    let right = landmarks[mouthRight]
    let upper = landmarks[mouthUpper]
    let lower = landmarks[mouthLower]
    let horizontal = distance(left, right)
    let vertical = distance(upper, lower)
    return horizontal == 0 ? 0 : vertical / horizontal
  }

  private static func ear(
    outer: NormalizedLandmark,
    inner: NormalizedLandmark,
    top1: NormalizedLandmark,
    top2: NormalizedLandmark,
    bottom1: NormalizedLandmark,
    bottom2: NormalizedLandmark
  ) -> Float {
    let vertical1 = distance(top1, bottom1)
    let vertical2 = distance(top2, bottom2)
    let horizontal = distance(outer, inner)
    return horizontal == 0 ? 0 : (vertical1 + vertical2) / (2 * horizontal)
  }

  private static func distance(_ a: NormalizedLandmark, _ b: NormalizedLandmark) -> Float {
    let dx = a.x - b.x
    let dy = a.y - b.y
    return sqrt(dx * dx + dy * dy)
  }
}
