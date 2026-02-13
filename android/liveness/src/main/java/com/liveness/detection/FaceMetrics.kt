package com.liveness.detection

import android.graphics.RectF

data class FaceMetrics(
  val yaw: Float,
  val pitch: Float,
  val roll: Float,
  val leftEyeEar: Float,
  val rightEyeEar: Float,
  val mouthMar: Float,
  val boundingBox: RectF?,
  val timestampMs: Long,
  val imageWidth: Int,
  val imageHeight: Int,
) {
  val avgEar: Float
    get() = (leftEyeEar + rightEyeEar) / 2f
}
