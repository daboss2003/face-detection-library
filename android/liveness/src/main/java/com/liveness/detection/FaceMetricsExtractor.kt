package com.liveness.detection

import android.graphics.RectF
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import kotlin.math.max
import kotlin.math.min
import kotlin.math.hypot

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

    val categories = result.faceBlendshapes().firstOrNull()?.categories() ?: emptyList()
    fun blendScore(name: String): Float {
      return categories.firstOrNull { it.categoryName() == name }?.score() ?: 0f
    }
    val blinkL = blendScore("eyeBlinkLeft")
    val blinkR = blendScore("eyeBlinkRight")
    val blinkScore = if (blinkL > 0f || blinkR > 0f) (blinkL + blinkR) / 2f else 0f
    val mouthScore = blendScore("jawOpen")

    var sumX = 0f
    var sumY = 0f
    for (lm in landmarks) {
      sumX += lm.x()
      sumY += lm.y()
    }
    val faceCx = sumX / landmarks.size
    val faceCy = sumY / landmarks.size
    val faceSize = distance(landmarks[33], landmarks[263])

    return FaceMetrics(
      yaw = pose.yaw,
      pitch = pose.pitch,
      roll = pose.roll,
      leftEyeEar = leftEar,
      rightEyeEar = rightEar,
      mouthMar = mar,
      blinkScore = blinkScore,
      mouthScore = mouthScore,
      faceCx = faceCx,
      faceCy = faceCy,
      faceSize = faceSize,
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

  private fun distance(
    a: com.google.mediapipe.tasks.components.containers.NormalizedLandmark,
    b: com.google.mediapipe.tasks.components.containers.NormalizedLandmark,
  ): Float {
    return hypot(a.x() - b.x(), a.y() - b.y())
  }
}
