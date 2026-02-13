import UIKit

final class FaceOverlayView: UIView {
  private let shapeLayer = CAShapeLayer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    shapeLayer.strokeColor = UIColor.green.cgColor
    shapeLayer.fillColor = UIColor.clear.cgColor
    shapeLayer.lineWidth = 2
    layer.addSublayer(shapeLayer)
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }

  func updateBoundingBox(_ rect: CGRect?) {
    guard let rect = rect else {
      shapeLayer.path = nil
      return
    }
    shapeLayer.path = UIBezierPath(rect: rect).cgPath
  }
}
