package com.liveness.detection

import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult

object TransformationMatrixExtractor {
  fun extract(result: FaceLandmarkerResult): FloatArray? {
    return try {
      val method = result.javaClass.getMethod("facialTransformationMatrixes")
      val matrices = method.invoke(result) as? List<*>
      val first = matrices?.firstOrNull() ?: return null
      extractMatrixData(first)
    } catch (_: Exception) {
      null
    }
  }

  private fun extractMatrixData(matrixObject: Any): FloatArray? {
    val candidates = listOf("getDataList", "dataList", "getData", "data")
    for (name in candidates) {
      try {
        val method = matrixObject.javaClass.getMethod(name)
        val data = method.invoke(matrixObject)
        val list = data as? List<*>
        if (list != null && list.isNotEmpty()) {
          val floats = list.mapNotNull { it as? Float }
          if (floats.isNotEmpty()) return floats.toFloatArray()
        }
      } catch (_: Exception) {
        continue
      }
    }
    return null
  }
}
