package com.liveness.detection

import android.graphics.RectF
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import kotlin.math.max
import kotlin.math.min

object FaceMetricsExtractor {
  fun extract(
    result: FaceLandmarkerResult,
    imageWidth: Int,
    imageHeight: Int,
  ): FaceMetrics? {
    val landmarks = result.faceLandmarks().firstOrNull() ?: return null

    val (leftEar, rightEar) = EyeMouthMetrics.computeEar(landmarks)
    val mar = EyeMouthMetrics.computeMar(landmarks)

    val pose = PoseEstimator.fromTransformationMatrix(
      TransformationMatrixExtractor.extract(result)
    ) ?: PoseEstimator.fromLandmarks(landmarks)

    val boundingBox = computeBoundingBox(landmarks, imageWidth, imageHeight)

    return FaceMetrics(
      yaw = pose.yaw,
      pitch = pose.pitch,
      roll = pose.roll,
      leftEyeEar = leftEar,
      rightEyeEar = rightEar,
      mouthMar = mar,
      boundingBox = boundingBox,
      timestampMs = result.timestampMs(),
      imageWidth = imageWidth,
      imageHeight = imageHeight,
    )
  }

  private fun computeBoundingBox(
    landmarks: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>,
    width: Int,
    height: Int,
  ): RectF {
    var minX = 1f
    var minY = 1f
    var maxX = 0f
    var maxY = 0f

    for (lm in landmarks) {
      minX = min(minX, lm.x())
      minY = min(minY, lm.y())
      maxX = max(maxX, lm.x())
      maxY = max(maxY, lm.y())
    }

    return RectF(
      minX * width,
      minY * height,
      maxX * width,
      maxY * height,
    )
  }
}
