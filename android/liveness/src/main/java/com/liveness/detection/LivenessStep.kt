package com.liveness.detection

enum class LivenessStep(val index: Int, val label: String) {
  TURN_LEFT(0, "Turn your head LEFT"),
  BLINK(1, "Blink"),
  TURN_RIGHT(2, "Turn your head RIGHT"),
  NOD(3, "Nod your head"),
  MOUTH(4, "Open your mouth");

  companion object {
    val ordered = listOf(TURN_LEFT, BLINK, TURN_RIGHT, NOD, MOUTH)
  }
}
