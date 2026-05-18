package com.liveness.demo

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.liveness.detection.LivenessActivity
import com.liveness.detection.LivenessErrorCodes
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

  private lateinit var startButton: Button
  private lateinit var statusText: TextView
  private lateinit var embedButton: Button

  private val livenessLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    if (result.resultCode == RESULT_OK) {
      val base64 = result.data?.getStringExtra(LivenessActivity.EXTRA_IMAGE_BASE64)
      statusText.text = if (!base64.isNullOrEmpty()) {
        "Liveness passed (image: ${base64.length} base64 chars)"
      } else "Liveness passed"
    } else {
      val reason = result.data?.getStringExtra(LivenessActivity.EXTRA_FAILURE_REASON) ?: "Cancelled"
      statusText.text = when {
        LivenessErrorCodes.isOffline(reason) -> "You're offline. Check your internet connection."
        LivenessErrorCodes.isCdnNotAvailable(reason) -> "Unable to reach the model host. Please try again later."
        else -> "Failed: $reason"
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    startButton = findViewById(R.id.startButton)
    statusText = findViewById(R.id.statusText)
    embedButton = findViewById(R.id.embedButton)

    embedButton.setOnClickListener {
      startActivity(Intent(this, EmbedActivity::class.java))
    }

    startButton.setOnClickListener {
      statusText.text = "Starting..."

      // Example: per-key sounds + a few tuned thresholds. Omit for defaults (web-SDK parity).
      val soundsJson = JSONObject().apply {
        put("baseUrl", "file:///android_asset/liveness-sounds")
      }.toString()
      val configJson = JSONObject().apply {
        put("shuffleSteps", true)
        put("yawTurnDelta", 9)
      }.toString()

      val intent = Intent(this, LivenessActivity::class.java).apply {
        putExtra(LivenessActivity.EXTRA_SOUNDS_JSON, soundsJson)
        putExtra(LivenessActivity.EXTRA_CONFIG_JSON, configJson)
      }
      livenessLauncher.launch(intent)
    }
  }
}
