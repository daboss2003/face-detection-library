import Foundation
import UIKit
import MediaPipeTasksVision

/// Full-screen liveness UI owned by the SDK. Present via `LivenessDetector.presentLiveness(from:...)`.
public final class LivenessViewController: UIViewController, LivenessDetectorDelegate {
  private let previewView = UIView()
  private let overlayView = LivenessOvalOverlayView()
  private let instructionLabel = UILabel()
  private let posHintLabel = UILabel()
  private let hintView = LivenessHintView()

  private var detector: LivenessDetector?
  private var modelUrl: String?
  private var sounds: LivenessSoundOptions?
  private var config: LivenessConfig = LivenessConfig()
  private var onSuccess: ((Data) -> Void)?
  private var onFailure: ((String) -> Void)?
  public var onChallengeChangedCallback: ((Int, String) -> Void)?
  public var onFaceInOvalCallback: ((Bool, String?) -> Void)?

  override public func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black

    previewView.translatesAutoresizingMaskIntoConstraints = false
    overlayView.translatesAutoresizingMaskIntoConstraints = false
    instructionLabel.translatesAutoresizingMaskIntoConstraints = false
    posHintLabel.translatesAutoresizingMaskIntoConstraints = false
    hintView.translatesAutoresizingMaskIntoConstraints = false

    instructionLabel.textColor = .white
    instructionLabel.textAlignment = .center
    instructionLabel.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
    instructionLabel.text = "Position your face in the oval"

    posHintLabel.textColor = UIColor(red: 1, green: 59/255, blue: 59/255, alpha: 1)
    posHintLabel.textAlignment = .center
    posHintLabel.font = UIFont.systemFont(ofSize: 13, weight: .medium)
    posHintLabel.isHidden = true

    view.addSubview(previewView)
    view.addSubview(overlayView)
    view.addSubview(instructionLabel)
    view.addSubview(posHintLabel)
    view.addSubview(hintView)

    NSLayoutConstraint.activate([
      previewView.topAnchor.constraint(equalTo: view.topAnchor),
      previewView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      previewView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      previewView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

      overlayView.topAnchor.constraint(equalTo: view.topAnchor),
      overlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      overlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      overlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

      instructionLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18),
      instructionLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      instructionLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor),

      posHintLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      posHintLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 40),

      hintView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      hintView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -80),
      hintView.widthAnchor.constraint(equalToConstant: 52),
      hintView.heightAnchor.constraint(equalToConstant: 52),
    ])
  }

  override public func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard detector == nil else { return }
    instructionLabel.text = "Position your face in the oval"
    detector = LivenessDetector(config: config, delegate: self, sounds: sounds)
    detector?.startLiveness(previewView: previewView, useFrontCamera: true, modelUrl: modelUrl ?? LivenessDetector.defaultModelURL)
  }

  override public func viewDidDisappear(_ animated: Bool) {
    detector?.stop()
    detector = nil
    super.viewDidDisappear(animated)
  }

  public func onChallengeChanged(stepIndex: Int, stepLabel: String) {
    DispatchQueue.main.async {
      self.instructionLabel.text = stepLabel
      if stepIndex >= 0 {
        self.overlayView.setProgress(stepIndex)
        self.overlayView.setStepDots(activeIndex: stepIndex)
        self.hintView.setHint(stepLabel: stepLabel)
      } else {
        self.overlayView.setProgress(5)
        self.overlayView.setStepDots(activeIndex: 5)
        self.hintView.setHint(stepLabel: nil)
      }
      if stepIndex >= 0 {
        self.onChallengeChangedCallback?(stepIndex, stepLabel)
      }
    }
  }

  public func onLivenessPassed(imageData: Data) {
    DispatchQueue.main.async {
      self.onSuccess?(imageData)
      self.dismiss(animated: true)
    }
  }

  public func onFailure(reason: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      let callback = self.onFailure
      self.dismiss(animated: true)
      callback?(reason)
    }
  }

  public func onFaceDetected(boundingBox: CGRect?) {}

  public func onFaceInOval(inside: Bool, reason: String?) {
    DispatchQueue.main.async {
      self.overlayView.setFaceInOval(inside)
      self.posHintLabel.isHidden = inside
      self.posHintLabel.text = reason ?? ""
      self.onFaceInOvalCallback?(inside, reason)
    }
  }

  static func create(modelUrl: String?, sounds: LivenessSoundOptions?, config: LivenessConfig = LivenessConfig(), onSuccess: @escaping (Data) -> Void, onFailure: @escaping (String) -> Void) -> LivenessViewController {
    let vc = LivenessViewController()
    vc.modelUrl = modelUrl
    vc.sounds = sounds
    vc.config = config
    vc.onSuccess = onSuccess
    vc.onFailure = onFailure
    vc.modalPresentationStyle = .fullScreen
    return vc
  }
}
