import Foundation

public enum LivenessStep: Int, CaseIterable {
  case turnLeft = 0
  case blink = 1
  case turnRight = 2
  case nod = 3
  case mouth = 4

  /// Display string surfaced to the user.
  public var label: String {
    switch self {
    case .turnLeft:  return "Turn your head LEFT"
    case .blink:     return "Blink"
    case .turnRight: return "Turn your head RIGHT"
    case .nod:       return "Nod your head"
    case .mouth:     return "Open your mouth"
    }
  }

  /// Short lowercase identifier used in configuration (matches the web SDK / sound-key form).
  public var key: String {
    switch self {
    case .turnLeft:  return "left"
    case .blink:     return "blink"
    case .turnRight: return "right"
    case .nod:       return "nod"
    case .mouth:     return "mouth"
    }
  }

  /// Resolve a caller-supplied list of step keys into the matching steps.
  /// Empty input, all-invalid input or `nil` falls back to all 5 in canonical order.
  /// Duplicates are dropped (first occurrence wins).
  public static func resolve(keys: [String]?) -> [LivenessStep] {
    guard let keys = keys, !keys.isEmpty else { return Array(LivenessStep.allCases) }
    let byKey = Dictionary(uniqueKeysWithValues: LivenessStep.allCases.map { ($0.key, $0) })
    var seen = Set<LivenessStep>()
    var out: [LivenessStep] = []
    for k in keys {
      if let step = byKey[k.lowercased()], !seen.contains(step) {
        seen.insert(step)
        out.append(step)
      }
    }
    return out.isEmpty ? Array(LivenessStep.allCases) : out
  }
}
