package com.liveness.detection

/**
 * Optional sound URLs or paths for liveness prompts.
 * Same contract as web: baseUrl + key + ".mp3" or per-key overrides.
 */
data class LivenessSoundOptions(
  val baseUrl: String? = null,
  val left: String? = null,
  val blink: String? = null,
  val right: String? = null,
  val nod: String? = null,
  val mouth: String? = null,
  val good: String? = null,
  val capture: String? = null,
) {
  fun getUrl(key: String): String? {
    val override = when (key) {
      "left" -> left
      "blink" -> blink
      "right" -> right
      "nod" -> nod
      "mouth" -> mouth
      "good" -> good
      "capture" -> capture
      else -> null
    }
    if (!override.isNullOrBlank()) return override
    val base = baseUrl?.trimEnd('/') ?: return null
    return "$base/$key.mp3"
  }
}
