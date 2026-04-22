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

  private const val CONNECTIVITY_CHECK_URL = "https://www.gstatic.com/generate_204"

  fun downloadIfNeeded(
    context: Context,
    url: String,
    fileName: String? = null,
    maxAttempts: Int = 5,
    attemptTimeoutMs: Int = 45_000,
    connectivityCheckTimeoutMs: Int = 5_000,
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
      for (attempt in 1..maxAttempts) {
        val result = downloadOnce(url, destFile, attemptTimeoutMs)
        when (result) {
          is DownloadResult.Success -> { onSuccess(destFile); return@thread }
          is DownloadResult.Retriable -> {
            if (attempt == 1 && !checkConnectivity(connectivityCheckTimeoutMs)) {
              onError(LivenessErrorCodes.OFFLINE)
              return@thread
            }
          }
          is DownloadResult.Fatal -> {
            onError(result.message)
            return@thread
          }
        }
      }
      onError(LivenessErrorCodes.CDN_NOT_AVAILABLE)
    }
  }

  private sealed class DownloadResult {
    data object Success : DownloadResult()
    data class Retriable(val message: String) : DownloadResult()
    data class Fatal(val message: String) : DownloadResult()
  }

  private fun downloadOnce(url: String, destFile: File, timeoutMs: Int): DownloadResult {
    var connection: HttpURLConnection? = null
    return try {
      connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = timeoutMs
        readTimeout = timeoutMs
        requestMethod = "GET"
        connect()
      }
      val code = connection.responseCode
      if (code !in 200..299) {
        if (code in listOf(404, 500, 502, 503)) {
          DownloadResult.Retriable("HTTP $code")
        } else {
          DownloadResult.Fatal("Model download failed: HTTP $code")
        }
      } else {
        connection.inputStream.use { input ->
          FileOutputStream(destFile).use { output -> input.copyTo(output) }
        }
        DownloadResult.Success
      }
    } catch (e: Exception) {
      DownloadResult.Retriable(e.message ?: "network error")
    } finally {
      connection?.disconnect()
    }
  }

  private fun checkConnectivity(timeoutMs: Int): Boolean {
    var connection: HttpURLConnection? = null
    return try {
      connection = (URL(CONNECTIVITY_CHECK_URL).openConnection() as HttpURLConnection).apply {
        connectTimeout = timeoutMs
        readTimeout = timeoutMs
        requestMethod = "HEAD"
        connect()
      }
      connection.responseCode in 200..299
    } catch (e: Exception) {
      false
    } finally {
      connection?.disconnect()
    }
  }
}
