import Foundation
import MediaPipeTasksVision

enum TransformationMatrixExtractor {
  static func extract(from result: FaceLandmarkerResult) -> [Float]? {
    let mirror = Mirror(reflecting: result)
    for child in mirror.children {
      if child.label == "facialTransformationMatrixes" {
        return flattenMatrix(child.value)
      }
    }
    return nil
  }

  private static func flattenMatrix(_ value: Any) -> [Float]? {
    if let array = value as? [[Float]], let first = array.first {
      return first
    }
    if let array = value as? [Float] {
      return array
    }
    if let array = value as? [Any], let first = array.first {
      if let data = first as? [Float] {
        return data
      }
      if let mirror = Mirror(reflecting: first).children.first(where: { $0.label == "data" }) {
        return mirror.value as? [Float]
      }
    }
    return nil
  }
}
