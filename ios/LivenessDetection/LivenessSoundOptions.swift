import Foundation

/// Optional sound URLs or paths for liveness prompts. Same contract as web.
public struct LivenessSoundOptions {
  public var baseUrl: String?
  public var left: String?
  public var blink: String?
  public var right: String?
  public var nod: String?
  public var mouth: String?
  public var good: String?
  public var capture: String?

  public init(
    baseUrl: String? = nil,
    left: String? = nil,
    blink: String? = nil,
    right: String? = nil,
    nod: String? = nil,
    mouth: String? = nil,
    good: String? = nil,
    capture: String? = nil
  ) {
    self.baseUrl = baseUrl
    self.left = left
    self.blink = blink
    self.right = right
    self.nod = nod
    self.mouth = mouth
    self.good = good
    self.capture = capture
  }

  public func url(forKey key: String) -> String? {
    let override: String?
    switch key {
    case "left": override = left
    case "blink": override = blink
    case "right": override = right
    case "nod": override = nod
    case "mouth": override = mouth
    case "good": override = good
    case "capture": override = capture
    default: override = nil
    }
    if let s = override, !s.isEmpty { return s }
    guard let base = baseUrl?.trimmingCharacters(in: CharacterSet(charactersIn: "/")) else { return nil }
    return "\(base)/\(key).mp3"
  }
}
