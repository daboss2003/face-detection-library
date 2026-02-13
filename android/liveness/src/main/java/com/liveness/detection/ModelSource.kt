package com.liveness.detection

sealed class ModelSource {
  data class Asset(val assetPath: String) : ModelSource()
  data class FilePath(val filePath: String) : ModelSource()
}
