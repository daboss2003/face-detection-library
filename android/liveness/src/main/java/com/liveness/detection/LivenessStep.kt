package com.liveness.detection

/**
 * Canonical liveness challenge step.
 *
 * `key` is the short lowercase identifier used in configuration (matching the
 * web SDK / sound-key form). `label` is the display string surfaced to the user.
 */
enum class LivenessStep(val index: Int, val key: String, val label: String) {
  TURN_LEFT(0,  "left",  "Turn your head LEFT"),
  BLINK    (1,  "blink", "Blink"),
  TURN_RIGHT(2, "right", "Turn your head RIGHT"),
  NOD      (3,  "nod",   "Nod your head"),
  MOUTH    (4,  "mouth", "Open your mouth");

  companion object {
    val ordered = listOf(TURN_LEFT, BLINK, TURN_RIGHT, NOD, MOUTH)

    /**
     * Resolve a caller-supplied list of step keys (e.g. `["nod", "blink"]`) into the
     * matching [LivenessStep]s. Empty input, all-invalid input, or `null` falls back
     * to all 5 steps in canonical order. Duplicates are dropped (first occurrence wins).
     */
    fun resolve(keys: List<String>?): List<LivenessStep> {
      if (keys.isNullOrEmpty()) return ordered
      val byKey = ordered.associateBy { it.key }
      val seen = HashSet<LivenessStep>()
      val out = ArrayList<LivenessStep>()
      for (k in keys) {
        val step = byKey[k.lowercase()] ?: continue
        if (seen.add(step)) out.add(step)
      }
      return if (out.isEmpty()) ordered else out
    }
  }
}
