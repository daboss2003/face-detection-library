package com.liveness.detection

/** Error codes surfaced via [LivenessListener.onFailure]. */
object LivenessErrorCodes {
  /** CDN/asset host unreachable after retries (internet confirmed). */
  const val CDN_NOT_AVAILABLE = "cdnNotAvailable"

  /** No internet connection. */
  const val OFFLINE = "offline"

  fun isCdnNotAvailable(reason: String): Boolean = reason == CDN_NOT_AVAILABLE
  fun isOffline(reason: String): Boolean = reason == OFFLINE
}

class LivenessError(
  val code: String,
  message: String,
) : RuntimeException(message)
