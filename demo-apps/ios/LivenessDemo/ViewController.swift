import UIKit
import LivenessDetection

final class ViewController: UIViewController, LivenessDetectorDelegate {
  private let previewView = UIView()
  private let overlayView = FaceOverlayView()
  private let challengeLabel = UILabel()
  private let statusLabel = UILabel()
  private let posHintLabel = UILabel()

  private var detector: LivenessDetector?

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black

    previewView.translatesAutoresizingMaskIntoConstraints = false
    overlayView.translatesAutoresizingMaskIntoConstraints = false
    challengeLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    posHintLabel.translatesAutoresizingMaskIntoConstraints = false

    challengeLabel.textColor = .white
    challengeLabel.backgroundColor = UIColor.black.withAlphaComponent(0.4)
    challengeLabel.textAlignment = .center
    challengeLabel.font = UIFont.systemFont(ofSize: 18, weight: .medium)

    statusLabel.textColor = .white
    statusLabel.backgroundColor = UIColor.black.withAlphaComponent(0.4)
    statusLabel.textAlignment = .center
    statusLabel.font = UIFont.systemFont(ofSize: 16, weight: .regular)

    posHintLabel.textColor = UIColor(red: 1, green: 59/255, blue: 59/255, alpha: 1)
    posHintLabel.textAlignment = .center
    posHintLabel.font = UIFont.systemFont(ofSize: 13, weight: .medium)
    posHintLabel.isHidden = true

    view.addSubview(previewView)
    view.addSubview(overlayView)
    view.addSubview(challengeLabel)
    view.addSubview(statusLabel)
    view.addSubview(posHintLabel)

    NSLayoutConstraint.activate([
      previewView.topAnchor.constraint(equalTo: view.topAnchor),
      previewView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      previewView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      previewView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

      overlayView.topAnchor.constraint(equalTo: view.topAnchor),
      overlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      overlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      overlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

      challengeLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      challengeLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      challengeLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      challengeLabel.heightAnchor.constraint(equalToConstant: 48),

      statusLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
      statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      statusLabel.heightAnchor.constraint(equalToConstant: 44),

      posHintLabel.bottomAnchor.constraint(equalTo: statusLabel.topAnchor),
      posHintLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      posHintLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    detector = LivenessDetector(delegate: self)
    detector?.startLiveness(previewView: previewView, useFrontCamera: true)
    statusLabel.text = "Running"
  }

  override func viewDidDisappear(_ animated: Bool) {
    detector?.stop()
    detector = nil
    super.viewDidDisappear(animated)
  }

  func onChallengeChanged(stepIndex: Int, stepLabel: String) {
    DispatchQueue.main.async {
      self.challengeLabel.text = stepLabel
      if stepIndex >= 0 {
        self.statusLabel.text = "Step \(stepIndex + 1) of 5"
        self.overlayView.setProgress(stepIndex)
        self.overlayView.setStepDots(activeIndex: stepIndex)
      } else {
        self.statusLabel.text = "Relax and look at the camera"
        self.overlayView.setProgress(5)
        self.overlayView.setStepDots(activeIndex: 5)
      }
    }
  }

  func onLivenessPassed(imageData: Data) {
    DispatchQueue.main.async {
      self.statusLabel.text = "Liveness passed (\(imageData.count) bytes)"
    }
  }

  func onFailure(reason: String) {
    DispatchQueue.main.async {
      self.statusLabel.text = "Failed: \(reason)"
    }
  }

  func onFaceDetected(boundingBox: CGRect?) {
    DispatchQueue.main.async {
      self.overlayView.updateBoundingBox(boundingBox)
    }
  }

  func onFaceInOval(inside: Bool, reason: String?) {
    DispatchQueue.main.async {
      self.overlayView.setFaceInOval(inside)
      self.posHintLabel.isHidden = inside
      self.posHintLabel.text = reason ?? ""
    }
  }
}
