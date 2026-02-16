package com.liveness.detection

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import kotlin.math.min

/** Full-screen overlay: dark mask with oval cutout, progress ring, step dots. */
class LivenessOvalOverlayView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
  defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

  companion object {
    private const val OVAL_TOP_PCT = 0.40f
    private const val STEP_COUNT = 5
  }

  private val ovalRect = RectF()
  private val darkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#D1000000")
    style = Paint.Style.FILL
  }
  private val darkPaintOutOfOval = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#8C000000")
    style = Paint.Style.FILL
  }
  private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.argb(38, 255, 255, 255)
    style = Paint.Style.STROKE
    strokeWidth = 3.5f
  }
  private val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#12c95c")
    style = Paint.Style.STROKE
    strokeWidth = 3.5f
    strokeCap = Paint.Cap.ROUND
  }
  private val progressPaintOutOfOval = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#ff3b3b")
    style = Paint.Style.STROKE
    strokeWidth = 3.5f
    strokeCap = Paint.Cap.ROUND
  }
  private val dotPaintInactive = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.argb(51, 255, 255, 255)
    style = Paint.Style.FILL
  }
  private val dotPaintActive = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#12c95c")
    style = Paint.Style.FILL
  }
  private val dotPaintDone = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#12c95c")
    style = Paint.Style.FILL
    alpha = 128
  }

  var faceInOval = true
    set(value) {
      if (field != value) { field = value; invalidate() }
    }
  var completedSteps = 0
    set(value) {
      val v = value.coerceIn(0, STEP_COUNT)
      if (field != v) { field = v; invalidate() }
    }
  var activeStepIndex = 0
    set(value) {
      val v = value.coerceIn(0, STEP_COUNT - 1)
      if (field != v) { field = v; invalidate() }
    }

  fun setFaceInOval(inside: Boolean) { faceInOval = inside }
  fun setProgress(completed: Int) { completedSteps = completed }
  fun setStepDots(activeIndex: Int) { activeStepIndex = activeIndex }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val w = width.toFloat()
    val h = height.toFloat()
    val ovalW = min(w * 0.72f, 270f)
    val ovalH = min(h * 0.45f, 360f)
    val cx = w / 2f
    val cy = h * OVAL_TOP_PCT
    ovalRect.set(cx - ovalW / 2, cy - ovalH / 2, cx + ovalW / 2, cy + ovalH / 2)

    val overlayPaint = if (faceInOval) darkPaint else darkPaintOutOfOval
    val path = Path().apply { addRect(0f, 0f, w, h, Path.Direction.CW) }
    val ovalPath = Path().apply { addOval(ovalRect, Path.Direction.CW) }
    path.op(ovalPath, Path.Op.DIFFERENCE)
    canvas.drawPath(path, overlayPaint)

    canvas.drawOval(ovalRect, trackPaint)
    val progressPaintToUse = if (faceInOval) progressPaint else progressPaintOutOfOval
    val sweep = 360f * (completedSteps.toFloat() / STEP_COUNT)
    canvas.drawArc(ovalRect, -90f, sweep, false, progressPaintToUse)

    val dotRadius = 3.5f
    val dotGap = 8f
    val totalDotsWidth = STEP_COUNT * (dotRadius * 2) + (STEP_COUNT - 1) * dotGap
    var dotLeft = cx - totalDotsWidth / 2f + dotRadius
    val dotY = cy + ovalH / 2f + 20f
    for (i in 0 until STEP_COUNT) {
      val p = when {
        i < activeStepIndex -> dotPaintDone
        i == activeStepIndex -> dotPaintActive
        else -> dotPaintInactive
      }
      canvas.drawCircle(dotLeft, dotY, dotRadius, p)
      dotLeft += dotRadius * 2 + dotGap
    }
  }
}
