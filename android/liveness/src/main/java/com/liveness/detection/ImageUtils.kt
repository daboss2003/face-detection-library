package com.liveness.detection

import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import androidx.camera.core.ImageProxy
import java.io.ByteArrayOutputStream

object ImageUtils {
  fun imageProxyToJpeg(image: ImageProxy): ByteArray {
    return if (image.format == ImageFormat.JPEG) {
      val buffer = image.planes[0].buffer
      val bytes = ByteArray(buffer.remaining())
      buffer.get(bytes)
      bytes
    } else {
      yuv420ToJpeg(image)
    }
  }

  private fun yuv420ToJpeg(image: ImageProxy): ByteArray {
    val nv21 = yuv420ToNv21(image)
    val yuvImage = YuvImage(
      nv21,
      ImageFormat.NV21,
      image.width,
      image.height,
      null
    )
    val out = ByteArrayOutputStream()
    yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 95, out)
    return out.toByteArray()
  }

  private fun yuv420ToNv21(image: ImageProxy): ByteArray {
    val yBuffer = image.planes[0].buffer
    val uBuffer = image.planes[1].buffer
    val vBuffer = image.planes[2].buffer

    val ySize = yBuffer.remaining()
    val uSize = uBuffer.remaining()
    val vSize = vBuffer.remaining()

    val nv21 = ByteArray(ySize + uSize + vSize)
    yBuffer.get(nv21, 0, ySize)

    val chromaRowStride = image.planes[1].rowStride
    val chromaRowPadding = chromaRowStride - image.width / 2
    var offset = ySize

    if (chromaRowPadding == 0) {
      vBuffer.get(nv21, offset, vSize)
      offset += vSize
      uBuffer.get(nv21, offset, uSize)
    } else {
      val vRow = ByteArray(chromaRowStride)
      val uRow = ByteArray(chromaRowStride)
      val rows = image.height / 2
      for (row in 0 until rows) {
        vBuffer.get(vRow, 0, chromaRowStride)
        uBuffer.get(uRow, 0, chromaRowStride)
        val length = chromaRowStride - chromaRowPadding
        System.arraycopy(vRow, 0, nv21, offset, length)
        offset += length
        System.arraycopy(uRow, 0, nv21, offset, length)
        offset += length
      }
    }
    return nv21
  }
}
