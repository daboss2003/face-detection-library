package com.liveness.detection

import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.PI

data class Pose(val yaw: Float, val pitch: Float, val roll: Float)

object PoseEstimator {
  fun fromTransformationMatrix(matrixData: FloatArray?): Pose? {
    if (matrixData == null || matrixData.size < 16) return null

    val r00 = matrixData[0]
    val r01 = matrixData[1]
    val r02 = matrixData[2]
    val r10 = matrixData[4]
    val r11 = matrixData[5]
    val r12 = matrixData[6]
    val r20 = matrixData[8]
    val r21 = matrixData[9]
    val r22 = matrixData[10]

    val pitch = asin(-r20)
    val yaw = atan2(r10, r00)
    val roll = atan2(r21, r22)

    return Pose(
      yaw = radToDeg(yaw),
      pitch = radToDeg(pitch),
      roll = radToDeg(roll),
    )
  }

  fun fromLandmarks(landmarks: List<NormalizedLandmark>): Pose {
    val leftEyeOuter = landmarks[33]
    val rightEyeOuter = landmarks[263]
    val noseTip = landmarks[1]
    val chin = landmarks[152]

    val yaw = atan2(
      rightEyeOuter.z() - leftEyeOuter.z(),
      rightEyeOuter.x() - leftEyeOuter.x(),
    )
    val roll = atan2(
      rightEyeOuter.y() - leftEyeOuter.y(),
      rightEyeOuter.x() - leftEyeOuter.x(),
    )
    val pitch = atan2(
      chin.y() - noseTip.y(),
      chin.z() - noseTip.z(),
    )

    return Pose(
      yaw = radToDeg(yaw),
      pitch = radToDeg(pitch),
      roll = radToDeg(roll),
    )
  }

  private fun radToDeg(value: Float): Float {
    return (value * 180f / PI.toFloat())
  }
}
