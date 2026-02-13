package com.liveness.detection

import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.channels.FileChannel

object ModelSourceReader {
  fun readFileAsByteBuffer(filePath: String): ByteBuffer {
    val file = File(filePath)
    FileInputStream(file).use { stream ->
      val channel = stream.channel
      return channel.map(FileChannel.MapMode.READ_ONLY, 0, file.length())
    }
  }
}
