package com.liveness.detection

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object ModelDownloader {
  const val DEFAULT_MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

  fun downloadIfNeeded(
    context: Context,
    url: String,
    fileName: String? = null,
    onSuccess: (File) -> Unit,
    onError: (String) -> Unit,
  ) {
    val targetName = fileName ?: url.substringAfterLast('/', "face_landmarker.task")
    val dir = File(context.filesDir, "liveness-models")
    if (!dir.exists()) {
      dir.mkdirs()
    }
    val destFile = File(dir, targetName)
    if (destFile.exists()) {
      onSuccess(destFile)
      return
    }

    thread {
      try {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        connection.requestMethod = "GET"
        connection.connect()
        if (connection.responseCode !in 200..299) {
          onError("Model download failed: HTTP ${connection.responseCode}")
          connection.disconnect()
          return@thread
        }
        connection.inputStream.use { input ->
          FileOutputStream(destFile).use { output ->
            input.copyTo(output)
          }
        }
        connection.disconnect()
        onSuccess(destFile)
      } catch (e: Exception) {
        onError("Model download failed: ${e.message}")
      }
    }
  }
}
