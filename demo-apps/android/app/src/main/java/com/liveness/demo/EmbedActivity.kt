package com.liveness.demo

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Outline
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.liveness.detection.LivenessConfig
import com.liveness.detection.LivenessErrorCodes
import com.liveness.detection.LivenessListener
import com.liveness.detection.LivenessSoundOptions
import com.liveness.detection.LivenessView

/**
 * Embedded liveness: drop the LivenessView into a slot inside your own UI.
 * Host owns the page chrome, instructions, and Start button; the SDK only
 * shows camera + face frame + progress ring inside the slot.
 */
class EmbedActivity : AppCompatActivity() {

  private lateinit var livenessView: LivenessView
  private lateinit var statusText: TextView
  private lateinit var startBtn: Button

  private val cameraPerm = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
  ) { granted ->
    if (granted) startLiveness()
    else statusText.text = "Camera permission required"
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_embed)

    val slot = findViewById<FrameLayout>(R.id.slot)
    statusText = findViewById(R.id.statusText)
    startBtn = findViewById(R.id.startButton)

    // Clip the slot to a circle so its corners don't show.
    slot.outlineProvider = object : ViewOutlineProvider() {
      override fun getOutline(view: View, outline: Outline) {
        outline.setOval(0, 0, view.width, view.height)
      }
    }
    slot.clipToOutline = true

    livenessView = LivenessView(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      )
      config = LivenessConfig(
        shape              = "circle",
        showInstructions   = false,
        minSizeDp          = 240f,
        progressColor      = Color.parseColor("#1A0F4D"),
        progressErrorColor = Color.parseColor("#FF3B3B"),
        progressWidthDp    = 4f,
        progressLineCap    = "round",
        overlayColor       = Color.parseColor("#5B34D6"),
        overlayErrorColor  = 0x99B40000.toInt(),
      )
      sounds = LivenessSoundOptions(baseUrl = "file:///android_asset/liveness-sounds")
      listener = object : LivenessListener {
        override fun onChallengeChanged(stepIndex: Int, stepLabel: String) {
          statusText.text = if (stepIndex == -1) "Hold still — capturing…" else stepLabel
        }
        override fun onFaceInOval(inside: Boolean, reason: String?) {
          if (!inside) statusText.text = reason ?: "Centre your face in the circle"
        }
        override fun onLivenessPassed(imageBytes: ByteArray) {
          val b64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
          statusText.text = "Verified (image: ${b64.length} chars)"
          startBtn.isEnabled = true
          startBtn.text = "Start again"
        }
        override fun onFailure(reason: String) {
          statusText.text = when {
            LivenessErrorCodes.isOffline(reason) -> "You're offline. Check your connection."
            LivenessErrorCodes.isCdnNotAvailable(reason) -> "Couldn't load resources. Try again."
            else -> "Failed: $reason"
          }
          startBtn.isEnabled = true
          startBtn.text = "Try again"
        }
        override fun onFaceDetected(boundingBox: android.graphics.RectF?) {}
      }
    }
    slot.addView(livenessView)

    startBtn.setOnClickListener {
      startBtn.isEnabled = false
      statusText.text = "Preparing camera…"
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
        startLiveness()
      } else {
        cameraPerm.launch(Manifest.permission.CAMERA)
      }
    }
  }

  private fun startLiveness() {
    livenessView.start(this)
  }

  override fun onPause() {
    livenessView.stop()
    super.onPause()
  }
}
