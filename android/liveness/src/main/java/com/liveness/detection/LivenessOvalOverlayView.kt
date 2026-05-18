package com.liveness.detection

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import kotlin.math.max
import kotlin.math.min

/**
 * Overlay: dark mask with oval/circle cutout, progress ring, optional step dots.
 *
 * Shape, colours, stroke width, line cap and minimum diameter are configurable via
 * [applyStyle] using the theme fields in [LivenessConfig]. When [showInstructions]
 * is false the step dots are hidden (text labels are owned by the parent view).
 */
class LivenessOvalOverlayView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
  defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

  companion object {
    private const val STEP_COUNT = 5
    // Max radii in dp — same semantics as the web SDK's OVAL_BASE / CIRCLE_BASE.
    private const val OVAL_MAX_W_DP = 270f
    private const val OVAL_MAX_H_DP = 360f
    private const val CIRCLE_MAX_DP = 270f
  }

  private val density = context.resources.displayMetrics.density
  private val ovalRect = RectF()

  // Paints with default web-parity values; replaced via applyStyle when config is set.
  private val darkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = 0xD1000000.toInt()
    style = Paint.Style.FILL
  }
  private val darkPaintOutOfOval = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = 0x8C000000.toInt()
    style = Paint.Style.FILL
  }
  private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.argb(38, 255, 255, 255)
    style = Paint.Style.STROKE
    strokeWidth = 3.5f * density
  }
  private val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#12c95c")
    style = Paint.Style.STROKE
    strokeWidth = 3.5f * density
    strokeCap = Paint.Cap.ROUND
  }
  private val progressPaintOutOfOval = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#ff3b3b")
    style = Paint.Style.STROKE
    strokeWidth = 3.5f * density
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

  private var shape: String = "oval"
  private var minSizePx: Float = 220f * density
  private var showDots: Boolean = true
  private var ovalTopFraction: Float = 0.40f

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

  /** Apply theme, shape and minimum size from [LivenessConfig]. */
  fun applyStyle(c: LivenessConfig) {
    shape = if (c.shape.equals("circle", ignoreCase = true)) "circle" else "oval"
    minSizePx = max(0f, c.minSizeDp) * density
    showDots = c.showInstructions
    // Place the cutout slightly above centre when there's room below for labels; otherwise centre it.
    ovalTopFraction = if (c.showInstructions) 0.40f else 0.50f

    darkPaint.color = c.overlayColor
    darkPaintOutOfOval.color = c.overlayErrorColor

    val cap = when (c.progressLineCap.lowercase()) {
      "square" -> Paint.Cap.SQUARE
      "butt"   -> Paint.Cap.BUTT
      else     -> Paint.Cap.ROUND
    }
    val strokePx = c.progressWidthDp * density
    progressPaint.color = c.progressColor
    progressPaint.strokeWidth = strokePx
    progressPaint.strokeCap = cap
    progressPaintOutOfOval.color = c.progressErrorColor
    progressPaintOutOfOval.strokeWidth = strokePx
    progressPaintOutOfOval.strokeCap = cap
    trackPaint.strokeWidth = strokePx

    dotPaintActive.color = c.progressColor
    dotPaintDone.color = c.progressColor
    dotPaintDone.alpha = 128

    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val w = width.toFloat()
    val h = height.toFloat()

    // Base sizing matches the web SDK: width = min(45vmin-equivalent, max-dp); height derives.
    val ovalW: Float
    val ovalH: Float
    if (shape == "circle") {
      val side = max(minSizePx, min(min(w * 0.72f, h * 0.55f), CIRCLE_MAX_DP * density))
      ovalW = side
      ovalH = side
    } else {
      val baseW = max(minSizePx, min(w * 0.72f, OVAL_MAX_W_DP * density))
      val baseH = max(minSizePx * (OVAL_MAX_H_DP / OVAL_MAX_W_DP), min(h * 0.55f, OVAL_MAX_H_DP * density))
      // Keep oval aspect roughly 270:360 unless screen forces shrinking
      val aspectH = baseW * (OVAL_MAX_H_DP / OVAL_MAX_W_DP)
      ovalW = baseW
      ovalH = min(baseH, aspectH)
    }

    val cx = w / 2f
    val cy = h * ovalTopFraction
    ovalRect.set(cx - ovalW / 2, cy - ovalH / 2, cx + ovalW / 2, cy + ovalH / 2)

    val overlayPaint = if (faceInOval) darkPaint else darkPaintOutOfOval
    val path = Path().apply { addRect(0f, 0f, w, h, Path.Direction.CW) }
    val cutoutPath = Path().apply { addOval(ovalRect, Path.Direction.CW) }
    path.op(cutoutPath, Path.Op.DIFFERENCE)
    canvas.drawPath(path, overlayPaint)

    canvas.drawOval(ovalRect, trackPaint)
    val progressPaintToUse = if (faceInOval) progressPaint else progressPaintOutOfOval
    val sweep = 360f * (completedSteps.toFloat() / STEP_COUNT)
    canvas.drawArc(ovalRect, -90f, sweep, false, progressPaintToUse)

    if (!showDots) return

    val dotRadius = 3.5f * density
    val dotGap = 8f * density
    val totalDotsWidth = STEP_COUNT * (dotRadius * 2) + (STEP_COUNT - 1) * dotGap
    var dotLeft = cx - totalDotsWidth / 2f + dotRadius
    val dotY = cy + ovalH / 2f + 20f * density
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
