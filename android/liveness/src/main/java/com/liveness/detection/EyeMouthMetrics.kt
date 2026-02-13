package com.liveness.detection

import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import kotlin.math.hypot

object EyeMouthMetrics {
  private const val LEFT_EYE_OUTER = 33
  private const val LEFT_EYE_INNER = 133
  private const val LEFT_EYE_TOP_1 = 160
  private const val LEFT_EYE_TOP_2 = 158
  private const val LEFT_EYE_BOTTOM_1 = 153
  private const val LEFT_EYE_BOTTOM_2 = 144

  private const val RIGHT_EYE_OUTER = 362
  private const val RIGHT_EYE_INNER = 263
  private const val RIGHT_EYE_TOP_1 = 385
  private const val RIGHT_EYE_TOP_2 = 387
  private const val RIGHT_EYE_BOTTOM_1 = 373
  private const val RIGHT_EYE_BOTTOM_2 = 380

  private const val MOUTH_LEFT = 61
  private const val MOUTH_RIGHT = 291
  private const val MOUTH_UPPER = 13
  private const val MOUTH_LOWER = 14

  fun computeEar(landmarks: List<NormalizedLandmark>): Pair<Float, Float> {
    val left = ear(
      landmarks[LEFT_EYE_OUTER],
      landmarks[LEFT_EYE_INNER],
      landmarks[LEFT_EYE_TOP_1],
      landmarks[LEFT_EYE_TOP_2],
      landmarks[LEFT_EYE_BOTTOM_1],
      landmarks[LEFT_EYE_BOTTOM_2],
    )
    val right = ear(
      landmarks[RIGHT_EYE_OUTER],
      landmarks[RIGHT_EYE_INNER],
      landmarks[RIGHT_EYE_TOP_1],
      landmarks[RIGHT_EYE_TOP_2],
      landmarks[RIGHT_EYE_BOTTOM_1],
      landmarks[RIGHT_EYE_BOTTOM_2],
    )
    return left to right
  }

  fun computeMar(landmarks: List<NormalizedLandmark>): Float {
    val left = landmarks[MOUTH_LEFT]
    val right = landmarks[MOUTH_RIGHT]
    val upper = landmarks[MOUTH_UPPER]
    val lower = landmarks[MOUTH_LOWER]
    val horizontal = distance(left, right)
    val vertical = distance(upper, lower)
    return if (horizontal == 0f) 0f else vertical / horizontal
  }

  private fun ear(
    outer: NormalizedLandmark,
    inner: NormalizedLandmark,
    top1: NormalizedLandmark,
    top2: NormalizedLandmark,
    bottom1: NormalizedLandmark,
    bottom2: NormalizedLandmark,
  ): Float {
    val vertical1 = distance(top1, bottom1)
    val vertical2 = distance(top2, bottom2)
    val horizontal = distance(outer, inner)
    return if (horizontal == 0f) 0f else (vertical1 + vertical2) / (2f * horizontal)
  }

  private fun distance(a: NormalizedLandmark, b: NormalizedLandmark): Float {
    return hypot(a.x() - b.x(), a.y() - b.y())
  }
}
