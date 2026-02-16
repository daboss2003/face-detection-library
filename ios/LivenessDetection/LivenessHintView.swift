import UIKit

/// Animated gesture hint (center of oval). Matches web: left/right/down arrow bounce, blink, mouth.
public final class LivenessHintView: UIView {
  public enum HintKind {
    case left
    case right
    case down
    case blink
    case mouth
    case none
  }

  private var hintKind: HintKind = .none
  private let shapeLayer = CAShapeLayer()
  private var animator: Any?  // CAAnimation or Timer-based

  override public init(frame: CGRect) {
    super.init(frame: frame)
    shapeLayer.strokeColor = UIColor.white.cgColor
    shapeLayer.fillColor = nil
    shapeLayer.lineWidth = 2.5
    shapeLayer.lineCap = .round
    shapeLayer.lineJoin = .round
    layer.addSublayer(shapeLayer)
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }

  public static func hintKind(forStepLabel label: String) -> HintKind {
    switch label {
    case LivenessStep.turnLeft.label: return .left
    case LivenessStep.blink.label: return .blink
    case LivenessStep.turnRight.label: return .right
    case LivenessStep.nod.label: return .down
    case LivenessStep.mouth.label: return .mouth
    default: return .none
    }
  }

  public func setHint(stepLabel: String?) {
    let kind: HintKind = stepLabel.flatMap { Self.hintKind(forStepLabel: $0) } ?? .none
    if hintKind == kind { return }
    hintKind = kind
    shapeLayer.removeAllAnimations()
    (animator as? CABasicAnimation)?.delegate = nil

    switch kind {
    case .left: startBounce(dx: -9, dy: 0, duration: 1)
    case .right: startBounce(dx: 9, dy: 0, duration: 1)
    case .down: startBounce(dx: 0, dy: 8, duration: 1)
    case .blink: startBlink(duration: 2)
    case .mouth: startMouth(duration: 1.5)
    case .none: break
    }
    setNeedsLayout()
    layoutIfNeeded()
  }

  private func startBounce(dx: CGFloat, dy: CGFloat, duration: CFTimeInterval) {
    let anim = CABasicAnimation(keyPath: "transform.translation.x")
    anim.fromValue = 0
    anim.toValue = dx
    anim.duration = duration / 2
    anim.autoreverses = true
    anim.repeatCount = .infinity
    anim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    if dx != 0 {
      layer.add(anim, forKey: "bounceX")
    }
    let animY = CABasicAnimation(keyPath: "transform.translation.y")
    animY.fromValue = 0
    animY.toValue = dy
    animY.duration = duration / 2
    animY.autoreverses = true
    animY.repeatCount = .infinity
    animY.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    if dy != 0 {
      layer.add(animY, forKey: "bounceY")
    }
  }

  private func startBlink(duration: CFTimeInterval) {
    let anim = CABasicAnimation(keyPath: "transform.scale.y")
    anim.fromValue = 1
    anim.toValue = 0.08
    anim.duration = duration / 2
    anim.autoreverses = true
    anim.repeatCount = .infinity
    anim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    shapeLayer.add(anim, forKey: "blink")
  }

  private func startMouth(duration: CFTimeInterval) {
    let anim = CABasicAnimation(keyPath: "transform.scale.y")
    anim.fromValue = 0.35
    anim.toValue = 1
    anim.duration = duration * 0.3
    anim.autoreverses = true
    anim.repeatCount = .infinity
    anim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    shapeLayer.add(anim, forKey: "mouth")
  }

  override public func layoutSubviews() {
    super.layoutSubviews()
    shapeLayer.frame = bounds
    let w = bounds.width
    let h = bounds.height
    let cx = w / 2
    let cy = h / 2
    let s = min(w, h) / 24

    let path: UIBezierPath
    switch hintKind {
    case .left:
      path = UIBezierPath()
      path.move(to: CGPoint(x: cx + 7 * s, y: cy))
      path.addLine(to: CGPoint(x: cx - 7 * s, y: cy))
      path.move(to: CGPoint(x: cx - 2 * s, y: cy - 7 * s))
      path.addLine(to: CGPoint(x: cx - 7 * s, y: cy))
      path.addLine(to: CGPoint(x: cx - 2 * s, y: cy + 7 * s))
    case .right:
      path = UIBezierPath()
      path.move(to: CGPoint(x: cx - 7 * s, y: cy))
      path.addLine(to: CGPoint(x: cx + 7 * s, y: cy))
      path.move(to: CGPoint(x: cx + 2 * s, y: cy - 7 * s))
      path.addLine(to: CGPoint(x: cx + 7 * s, y: cy))
      path.addLine(to: CGPoint(x: cx + 2 * s, y: cy + 7 * s))
    case .down:
      path = UIBezierPath()
      path.move(to: CGPoint(x: cx, y: cy - 7 * s))
      path.addLine(to: CGPoint(x: cx, y: cy + 7 * s))
      path.move(to: CGPoint(x: cx - 7 * s, y: cy + 2 * s))
      path.addLine(to: CGPoint(x: cx, y: cy + 7 * s))
      path.addLine(to: CGPoint(x: cx + 7 * s, y: cy + 2 * s))
    case .blink:
      path = UIBezierPath()
      path.append(UIBezierPath(ovalIn: CGRect(x: cx - 10 * s, y: cy - 2.5 * s, width: 4 * s, height: 5 * s)))
      path.append(UIBezierPath(ovalIn: CGRect(x: cx + 6 * s, y: cy - 2.5 * s, width: 4 * s, height: 5 * s)))
    case .mouth:
      path = UIBezierPath()
      path.move(to: CGPoint(x: cx - 6 * s, y: cy + 2 * s))
      path.addQuadCurve(to: CGPoint(x: cx + 6 * s, y: cy + 2 * s), controlPoint: CGPoint(x: cx, y: cy + 9 * s))
    case .none:
      path = UIBezierPath()
    }
    shapeLayer.path = path.cgPath
  }
}
