import Foundation

/// Error codes surfaced via `LivenessDetectorDelegate.onFailure`.
@objc public final class LivenessErrorCodes: NSObject {
  /// CDN/asset host unreachable after retries (internet confirmed).
  @objc public static let cdnNotAvailable = "cdnNotAvailable"

  /// No internet connection.
  @objc public static let offline = "offline"

  @objc public static func isCdnNotAvailable(_ reason: String) -> Bool {
    return reason == cdnNotAvailable
  }

  @objc public static func isOffline(_ reason: String) -> Bool {
    return reason == offline
  }

  private override init() { super.init() }
}

public struct LivenessError: Error {
  public let code: String
  public let message: String

  public init(code: String, message: String) {
    self.code = code
    self.message = message
  }
}
