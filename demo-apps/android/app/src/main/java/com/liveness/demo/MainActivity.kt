package com.liveness.demo

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.liveness.detection.LivenessActivity

class MainActivity : AppCompatActivity() {

  private lateinit var startButton: Button
  private lateinit var statusText: TextView

  private val livenessLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    if (result.resultCode == RESULT_OK) {
      val base64 = result.data?.getStringExtra(LivenessActivity.EXTRA_IMAGE_BASE64)
      statusText.text = if (!base64.isNullOrEmpty()) "Liveness passed (image received)" else "Liveness passed"
    } else {
      val reason = result.data?.getStringExtra(LivenessActivity.EXTRA_FAILURE_REASON) ?: "Cancelled"
      statusText.text = "Failed: $reason"
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    startButton = findViewById(R.id.startButton)
    statusText = findViewById(R.id.statusText)

    startButton.setOnClickListener {
      statusText.text = "Starting..."
      val intent = Intent(this, LivenessActivity::class.java)
      livenessLauncher.launch(intent)
    }
  }
}
