package com.liveness.detection

import android.graphics.RectF

interface LivenessListener {
  fun onChallengeChanged(stepIndex: Int, stepLabel: String)
  fun onLivenessPassed(imageBytes: ByteArray)
  fun onFailure(reason: String)
  fun onFaceDetected(boundingBox: RectF?) {}
  fun onFaceInOval(inside: Boolean, reason: String?) {}
}
