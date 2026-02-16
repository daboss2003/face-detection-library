package com.liveness.detection

import android.content.Context
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import java.io.File

/**
 * Plays liveness sounds from LivenessSoundOptions (file path or URL).
 * Runs on main thread for MediaPlayer callbacks.
 */
internal class LivenessSoundPlayer(
  private val context: Context,
  private val options: LivenessSoundOptions?,
) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var currentPlayer: MediaPlayer? = null

  fun getUrl(key: String): String? = options?.getUrl(key)

  fun play(key: String, onEnded: (() -> Unit)? = null) {
    val url = getUrl(key) ?: run {
      onEnded?.invoke()
      return
    }
    mainHandler.post {
      releaseCurrent()
      try {
        val player = MediaPlayer().apply {
          setOnCompletionListener {
            releaseCurrent()
            onEnded?.invoke()
          }
          setOnErrorListener { _, _, _ ->
            releaseCurrent()
            onEnded?.invoke()
            true
          }
        }
        when {
          url.startsWith("http://") || url.startsWith("https://") ->
            player.setDataSource(context, Uri.parse(url))
          url.startsWith("file://") ->
            player.setDataSource(context, Uri.parse(url))
          else -> {
            val file = File(url)
            if (file.exists()) player.setDataSource(file.absolutePath)
            else {
              onEnded?.invoke()
              return@post
            }
          }
        }
        player.prepareAsync()
        player.setOnPreparedListener { it.start() }
        currentPlayer = player
      } catch (e: Exception) {
        releaseCurrent()
        onEnded?.invoke()
      }
    }
  }

  fun stop() {
    mainHandler.post { releaseCurrent() }
  }

  private fun releaseCurrent() {
    try {
      currentPlayer?.release()
    } catch (_: Exception) { }
    currentPlayer = null
  }
}
