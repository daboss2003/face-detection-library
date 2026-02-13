package com.liveness.demo

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

class FaceOverlayView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {
  private val paint = Paint().apply {
    color = Color.GREEN
    style = Paint.Style.STROKE
    strokeWidth = 4f
  }
  private var boundingBox: RectF? = null

  fun updateBoundingBox(rect: RectF?) {
    boundingBox = rect
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    boundingBox?.let { rect ->
      canvas.drawRect(rect, paint)
    }
  }
}
