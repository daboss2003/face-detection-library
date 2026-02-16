package com.liveness.detection

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import kotlin.math.min

/**
 * Animated gesture hint icon (center of oval). Matches web: left/right/down arrow bounce,
 * blink eyes, mouth open/close.
 */
class LivenessHintView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
  defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

  enum class HintKind { LEFT, RIGHT, DOWN, BLINK, MOUTH, NONE }

  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = 0xFFFFFFFF.toInt()
    style = Paint.Style.STROKE
    strokeWidth = 2.5f
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }

  private var hintKind = HintKind.NONE
  private var animPhase = 0f
  private var animator: ValueAnimator? = null

  private val dp = context.resources.displayMetrics.density

  fun setHint(stepLabel: String?) {
    val kind = when (stepLabel) {
      LivenessStep.TURN_LEFT.label -> HintKind.LEFT
      LivenessStep.BLINK.label -> HintKind.BLINK
      LivenessStep.TURN_RIGHT.label -> HintKind.RIGHT
      LivenessStep.NOD.label -> HintKind.DOWN
      LivenessStep.MOUTH.label -> HintKind.MOUTH
      else -> HintKind.NONE
    }
    if (hintKind == kind) return
    hintKind = kind
    animator?.cancel()
    animator = null
    when (kind) {
      HintKind.LEFT -> startBounce(-9f * dp, 0f, 0f, 1000)
      HintKind.RIGHT -> startBounce(9f * dp, 0f, 0f, 1000)
      HintKind.DOWN -> startBounce(0f, 8f * dp, 0f, 1000)
      HintKind.BLINK -> startScaleY(1f, 0.08f, 2000)
      HintKind.MOUTH -> startMouthAnim()
      HintKind.NONE -> Unit
    }
    invalidate()
  }

  private fun startBounce(targetX: Float, targetY: Float, targetScale: Float, duration: Long) {
    animator = ValueAnimator.ofFloat(0f, 1f).apply {
      this.duration = duration
      interpolator = AccelerateDecelerateInterpolator()
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.REVERSE
      addUpdateListener {
        animPhase = it.animatedValue as Float
        invalidate()
      }
      start()
    }
  }

  private fun startScaleY(from: Float, to: Float, duration: Long) {
    animator = ValueAnimator.ofFloat(0f, 1f).apply {
      this.duration = duration
      interpolator = AccelerateDecelerateInterpolator()
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.REVERSE
      addUpdateListener {
        animPhase = it.animatedValue as Float
        invalidate()
      }
      start()
    }
  }

  private fun startMouthAnim() {
    animator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 1500
      interpolator = AccelerateDecelerateInterpolator()
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.RESTART
      addUpdateListener {
        animPhase = it.animatedValue as Float
        invalidate()
      }
      start()
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    animator?.cancel()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val w = width.toFloat()
    val h = height.toFloat()
    val cx = w / 2f
    val cy = h / 2f
    val s = min(w, h) / 24f

    when (hintKind) {
      HintKind.LEFT -> {
        val t = min(animPhase, 1f - animPhase) * 2f
        val dx = -9f * dp * t
        canvas.save()
        canvas.translate(dx, 0f)
        drawArrowLeft(canvas, cx, cy, s)
        canvas.restore()
      }
      HintKind.RIGHT -> {
        val t = min(animPhase, 1f - animPhase) * 2f
        val dx = 9f * dp * t
        canvas.save()
        canvas.translate(dx, 0f)
        drawArrowRight(canvas, cx, cy, s)
        canvas.restore()
      }
      HintKind.DOWN -> {
        val t = min(animPhase, 1f - animPhase) * 2f
        val dy = 8f * dp * t
        canvas.save()
        canvas.translate(0f, dy)
        drawArrowDown(canvas, cx, cy, s)
        canvas.restore()
      }
      HintKind.BLINK -> {
        val t = min(animPhase, 1f - animPhase) * 2f
        val scaleY = 1f - (1f - 0.08f) * t
        canvas.save()
        canvas.translate(cx - 8 * s, cy - 2.5f * s)
        canvas.scale(1f, scaleY)
        canvas.translate(-(cx - 8 * s), -(cy - 2.5f * s))
        drawEyes(canvas, cx, cy, s)
        canvas.restore()
      }
      HintKind.MOUTH -> {
        val scaleY = 0.35f + (1f - 0.35f) * (if (animPhase < 0.3f) animPhase / 0.3f else if (animPhase < 0.6f) (0.6f - animPhase) / 0.3f else 0f)
        canvas.save()
        canvas.translate(cx, cy - 4 * s)
        canvas.scale(1f, scaleY)
        canvas.translate(-cx, -(cy - 4 * s))
        drawMouth(canvas, cx, cy, s)
        canvas.restore()
      }
      HintKind.NONE -> Unit
    }
  }

  private fun drawArrowLeft(canvas: Canvas, cx: Float, cy: Float, s: Float) {
    val p = Path().apply {
      moveTo(cx + 7 * s, cy)
      lineTo(cx - 7 * s, cy)
      moveTo(cx - 2 * s, cy - 7 * s)
      lineTo(cx - 7 * s, cy)
      lineTo(cx - 2 * s, cy + 7 * s)
    }
    canvas.drawPath(p, paint)
  }

  private fun drawArrowRight(canvas: Canvas, cx: Float, cy: Float, s: Float) {
    val p = Path().apply {
      moveTo(cx - 7 * s, cy)
      lineTo(cx + 7 * s, cy)
      moveTo(cx + 2 * s, cy - 7 * s)
      lineTo(cx + 7 * s, cy)
      lineTo(cx + 2 * s, cy + 7 * s)
    }
    canvas.drawPath(p, paint)
  }

  private fun drawArrowDown(canvas: Canvas, cx: Float, cy: Float, s: Float) {
    val p = Path().apply {
      moveTo(cx, cy - 7 * s)
      lineTo(cx, cy + 7 * s)
      moveTo(cx - 7 * s, cy + 2 * s)
      lineTo(cx, cy + 7 * s)
      lineTo(cx + 7 * s, cy + 2 * s)
    }
    canvas.drawPath(p, paint)
  }

  private fun drawEyes(canvas: Canvas, cx: Float, cy: Float, s: Float) {
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 2f * width / 24f
    canvas.drawOval(cx - 10 * s, cy - 2.5f * s, cx - 6 * s, cy + 2.5f * s, paint)
    canvas.drawOval(cx + 6 * s, cy - 2.5f * s, cx + 10 * s, cy + 2.5f * s, paint)
    paint.strokeWidth = 2.5f
  }

  private fun drawMouth(canvas: Canvas, cx: Float, cy: Float, s: Float) {
    val p = Path().apply {
      moveTo(cx - 6 * s, cy + 2 * s)
      quadTo(cx, cy + 9 * s, cx + 6 * s, cy + 2 * s)
    }
    canvas.drawPath(p, paint)
  }
}
