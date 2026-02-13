import Foundation

public enum LivenessStep: Int, CaseIterable {
  case turnLeft = 0
  case blink = 1
  case turnRight = 2
  case nod = 3
  case mouth = 4

  public var label: String {
    switch self {
    case .turnLeft: return "Turn your head LEFT"
    case .blink: return "Blink"
    case .turnRight: return "Turn your head RIGHT"
    case .nod: return "Nod your head"
    case .mouth: return "Open your mouth"
    }
  }
}
