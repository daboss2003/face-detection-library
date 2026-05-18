import UIKit

/// Overlay: dark mask with oval/circle cutout, progress ring, optional step dots.
///
/// Shape, colours, stroke width, line cap and minimum diameter are configurable via
/// `applyStyle(_:)` using the theme fields in `LivenessConfig`. When `showInstructions`
/// is false the step dots are hidden (text labels are owned by the parent view).
public final class LivenessOvalOverlayView: UIView {
  private static let stepCount = 5
  // Max radii (pt) — mirrors web SDK's OVAL_BASE / CIRCLE_BASE.
  private static let ovalMaxW: CGFloat = 270
  private static let ovalMaxH: CGFloat = 360
  private static let circleMax: CGFloat = 270

  private let darkLayer = CALayer()
  private let ovalMaskLayer = CAShapeLayer()
  private let trackLayer = CAShapeLayer()
  private let progressLayer = CAShapeLayer()
  private var dotLayers: [CAShapeLayer] = []

  private var faceInOval = true
  private var completedSteps = 0
  private var activeStepIndex = 0

  // Styling — populated by applyStyle, with web-parity defaults.
  private var shape: String = "oval"
  private var minSize: CGFloat = 220
  private var showDots: Bool = true
  private var ovalTopFraction: CGFloat = 0.40
  private var progressColor: UIColor = UIColor(red: 18/255, green: 201/255, blue: 92/255, alpha: 1)
  private var progressErrorColor: UIColor = UIColor(red: 1, green: 59/255, blue: 59/255, alpha: 1)
  private var progressWidth: CGFloat = 3.5
  private var progressLineCap: CAShapeLayerLineCap = .round
  private var overlayColor: UIColor = UIColor(white: 0, alpha: 0.82)
  private var overlayErrorColor: UIColor = UIColor(red: 180/255, green: 0, blue: 0, alpha: 0.55)

  override public init(frame: CGRect) {
    super.init(frame: frame)
    setupLayers()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupLayers()
  }

  private func setupLayers() {
    darkLayer.backgroundColor = overlayColor.cgColor
    layer.addSublayer(darkLayer)
    ovalMaskLayer.fillRule = .evenOdd
    darkLayer.mask = ovalMaskLayer
    trackLayer.fillColor = nil
    trackLayer.strokeColor = UIColor.white.withAlphaComponent(0.15).cgColor
    trackLayer.lineWidth = progressWidth
    layer.addSublayer(trackLayer)
    progressLayer.fillColor = nil
    progressLayer.lineWidth = progressWidth
    progressLayer.lineCap = progressLineCap
    progressLayer.strokeColor = progressColor.cgColor
    layer.addSublayer(progressLayer)
    for _ in 0..<Self.stepCount {
      let dot = CAShapeLayer()
      dot.path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: 7, height: 7)).cgPath
      layer.addSublayer(dot)
      dotLayers.append(dot)
    }
  }

  public func applyStyle(_ c: LivenessConfig) {
    shape = c.shape.lowercased() == "circle" ? "circle" : "oval"
    minSize = max(0, c.minSize)
    showDots = c.showInstructions
    ovalTopFraction = c.showInstructions ? 0.40 : 0.50

    progressColor = c.progressColor
    progressErrorColor = c.progressErrorColor
    progressWidth = c.progressWidth
    overlayColor = c.overlayColor
    overlayErrorColor = c.overlayErrorColor
    switch c.progressLineCap.lowercased() {
    case "square": progressLineCap = .square
    case "butt":   progressLineCap = .butt
    default:       progressLineCap = .round
    }

    trackLayer.lineWidth = progressWidth
    progressLayer.lineWidth = progressWidth
    progressLayer.lineCap = progressLineCap
    progressLayer.strokeColor = (faceInOval ? progressColor : progressErrorColor).cgColor
    darkLayer.backgroundColor = (faceInOval ? overlayColor : overlayErrorColor).cgColor

    for dot in dotLayers { dot.isHidden = !showDots }

    setNeedsLayout()
  }

  public func setFaceInOval(_ inside: Bool) {
    guard faceInOval != inside else { return }
    faceInOval = inside
    darkLayer.backgroundColor = (inside ? overlayColor : overlayErrorColor).cgColor
    progressLayer.strokeColor = (inside ? progressColor : progressErrorColor).cgColor
  }

  public func setProgress(_ completed: Int) {
    guard completedSteps != completed else { return }
    completedSteps = min(max(completed, 0), Self.stepCount)
    setNeedsLayout()
  }

  public func setStepDots(activeIndex: Int) {
    guard activeStepIndex != activeIndex else { return }
    activeStepIndex = min(max(activeIndex, 0), Self.stepCount - 1)
    setNeedsLayout()
  }

  override public func layoutSubviews() {
    super.layoutSubviews()
    let w = bounds.width
    let h = bounds.height

    let ovalW: CGFloat
    let ovalH: CGFloat
    if shape == "circle" {
      let side = max(minSize, min(min(w * 0.72, h * 0.55), Self.circleMax))
      ovalW = side
      ovalH = side
    } else {
      let baseW = max(minSize, min(w * 0.72, Self.ovalMaxW))
      let aspectH = baseW * (Self.ovalMaxH / Self.ovalMaxW)
      let baseH = max(minSize * (Self.ovalMaxH / Self.ovalMaxW), min(h * 0.55, Self.ovalMaxH))
      ovalW = baseW
      ovalH = min(baseH, aspectH)
    }

    let cx = w / 2
    let cy = h * ovalTopFraction
    let ovalRect = CGRect(x: cx - ovalW/2, y: cy - ovalH/2, width: ovalW, height: ovalH)

    darkLayer.frame = bounds
    ovalMaskLayer.frame = bounds
    let fullPath = UIBezierPath(rect: bounds)
    fullPath.append(UIBezierPath(ovalIn: ovalRect))
    ovalMaskLayer.path = fullPath.cgPath

    trackLayer.frame = bounds
    trackLayer.path = UIBezierPath(ovalIn: ovalRect).cgPath

    // Approximate progress sweep along the ellipse perimeter
    let sweep = 2 * CGFloat.pi * (CGFloat(completedSteps) / CGFloat(Self.stepCount))
    let startAngle = -CGFloat.pi / 2
    let progressPath = UIBezierPath(arcCenter: CGPoint(x: ovalRect.midX, y: ovalRect.midY),
                                    radius: ovalW/2 - progressWidth/2,
                                    startAngle: startAngle,
                                    endAngle: startAngle + sweep,
                                    clockwise: true)
    progressLayer.frame = bounds
    progressLayer.path = progressPath.cgPath

    if !showDots {
      for dot in dotLayers { dot.isHidden = true }
      return
    }

    let dotRadius: CGFloat = 3.5
    let dotGap: CGFloat = 8
    let totalWidth = CGFloat(Self.stepCount) * (dotRadius * 2) + CGFloat(Self.stepCount - 1) * dotGap
    var dotX = cx - totalWidth/2 + dotRadius
    let dotY = cy + ovalH/2 + 20
    let done = progressColor.withAlphaComponent(0.5).cgColor
    let active = progressColor.cgColor
    let inactive = UIColor.white.withAlphaComponent(0.2).cgColor
    for (i, dot) in dotLayers.enumerated() {
      dot.isHidden = false
      dot.frame = CGRect(x: dotX - dotRadius, y: dotY - dotRadius, width: 7, height: 7)
      if i < activeStepIndex {
        dot.fillColor = done
      } else if i == activeStepIndex {
        dot.fillColor = active
      } else {
        dot.fillColor = inactive
      }
      dotX += dotRadius * 2 + dotGap
    }
  }
}
