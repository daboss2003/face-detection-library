import UIKit

final class FaceOverlayView: UIView {
  private static let ovalTopPct: CGFloat = 0.40
  private static let stepCount = 5

  private let darkLayer = CALayer()
  private let ovalMaskLayer = CAShapeLayer()
  private let trackLayer = CAShapeLayer()
  private let progressLayer = CAShapeLayer()
  private var dotLayers: [CAShapeLayer] = []

  private var faceInOval = true
  private var completedSteps = 0
  private var activeStepIndex = 0

  override init(frame: CGRect) {
    super.init(frame: frame)
    darkLayer.backgroundColor = UIColor(white: 0, alpha: 0.82).cgColor
    layer.addSublayer(darkLayer)

    ovalMaskLayer.fillRule = .evenOdd
    darkLayer.mask = ovalMaskLayer

    trackLayer.fillColor = nil
    trackLayer.strokeColor = UIColor.white.withAlphaComponent(0.15).cgColor
    trackLayer.lineWidth = 3.5
    layer.addSublayer(trackLayer)

    progressLayer.fillColor = nil
    progressLayer.lineWidth = 3.5
    progressLayer.lineCap = .round
    progressLayer.strokeColor = UIColor(red: 18/255, green: 201/255, blue: 92/255, alpha: 1).cgColor
    layer.addSublayer(progressLayer)

    for _ in 0..<Self.stepCount {
      let dot = CAShapeLayer()
      dot.path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: 7, height: 7)).cgPath
      layer.addSublayer(dot)
      dotLayers.append(dot)
    }
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }

  func updateBoundingBox(_ rect: CGRect?) {
    // Optional: could draw bbox; web demo uses oval only
  }

  func setFaceInOval(_ inside: Bool) {
    guard faceInOval != inside else { return }
    faceInOval = inside
    darkLayer.backgroundColor = inside
        ? UIColor(white: 0, alpha: 0.82).cgColor
        : UIColor(red: 0.55, green: 0, blue: 0, alpha: 1).cgColor
    progressLayer.strokeColor = inside
        ? UIColor(red: 18/255, green: 201/255, blue: 92/255, alpha: 1).cgColor
        : UIColor(red: 1, green: 59/255, blue: 59/255, alpha: 1).cgColor
  }

  func setProgress(_ completed: Int) {
    guard completedSteps != completed else { return }
    completedSteps = min(max(completed, 0), Self.stepCount)
    setNeedsLayout()
  }

  func setStepDots(activeIndex: Int) {
    guard activeStepIndex != activeIndex else { return }
    activeStepIndex = min(max(activeIndex, 0), Self.stepCount - 1)
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let w = bounds.width
    let h = bounds.height
    let ovalW = min(w * 0.72, 270)
    let ovalH = min(h * 0.45, 360)
    let cx = w / 2
    let cy = h * Self.ovalTopPct
    let ovalRect = CGRect(x: cx - ovalW/2, y: cy - ovalH/2, width: ovalW, height: ovalH)

    darkLayer.frame = bounds
    let fullPath = UIBezierPath(rect: bounds)
    fullPath.append(UIBezierPath(ovalIn: ovalRect))
    ovalMaskLayer.path = fullPath.cgPath

    trackLayer.frame = bounds
    trackLayer.path = UIBezierPath(ovalIn: ovalRect).cgPath

    let sweep = 2 * CGFloat.pi * (CGFloat(completedSteps) / CGFloat(Self.stepCount))
    let startAngle = -CGFloat.pi / 2
    let progressPath = UIBezierPath(arcCenter: CGPoint(x: ovalRect.midX, y: ovalRect.midY),
                                    radius: ovalW/2 - 2,
                                    startAngle: startAngle,
                                    endAngle: startAngle + sweep,
                                    clockwise: true)
    progressLayer.frame = bounds
    progressLayer.path = progressPath.cgPath

    let dotRadius: CGFloat = 3.5
    let dotGap: CGFloat = 8
    let totalWidth = CGFloat(Self.stepCount) * (dotRadius * 2) + CGFloat(Self.stepCount - 1) * dotGap
    var dotX = cx - totalWidth/2 + dotRadius
    let dotY = cy + ovalH/2 + 20
    for (i, dot) in dotLayers.enumerated() {
      dot.frame = CGRect(x: dotX - dotRadius, y: dotY - dotRadius, width: 7, height: 7)
      if i < activeStepIndex {
        dot.fillColor = UIColor(red: 18/255, green: 201/255, blue: 92/255, alpha: 0.5).cgColor
      } else if i == activeStepIndex {
        dot.fillColor = UIColor(red: 18/255, green: 201/255, blue: 92/255, alpha: 1).cgColor
      } else {
        dot.fillColor = UIColor.white.withAlphaComponent(0.2).cgColor
      }
      dotX += dotRadius * 2 + dotGap
    }
  }
}
