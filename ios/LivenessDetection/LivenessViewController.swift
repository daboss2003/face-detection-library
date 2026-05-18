import Foundation
import UIKit
import MediaPipeTasksVision

/// Full-screen liveness UI owned by the SDK. Present via `LivenessDetector.presentLiveness(from:...)`.
///
/// For embedded usage (rendering the camera inside your own UI), use `LivenessView` directly
/// instead of presenting this view controller.
public final class LivenessViewController: UIViewController, LivenessDetectorDelegate {
  private let livenessView = LivenessView()

  private var modelUrl: String?
  private var sounds: LivenessSoundOptions?
  private var configToApply: LivenessConfig = LivenessConfig()
  private var onSuccess: ((Data) -> Void)?
  private var onFailureCallback: ((String) -> Void)?
  public var onChallengeChangedCallback: ((Int, String) -> Void)?
  public var onFaceInOvalCallback: ((Bool, String?) -> Void)?

  override public func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black

    livenessView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(livenessView)
    NSLayoutConstraint.activate([
      livenessView.topAnchor.constraint(equalTo: view.topAnchor),
      livenessView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      livenessView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      livenessView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])

    livenessView.modelUrl = modelUrl
    livenessView.sounds = sounds
    livenessView.config = configToApply
    livenessView.delegate = self
  }

  override public func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    livenessView.start()
  }

  override public func viewDidDisappear(_ animated: Bool) {
    livenessView.stop()
    super.viewDidDisappear(animated)
  }

  // ── LivenessDetectorDelegate ────────────────────────────────────────────

  public func onChallengeChanged(stepIndex: Int, stepLabel: String) {
    if stepIndex >= 0 {
      onChallengeChangedCallback?(stepIndex, stepLabel)
    }
  }

  public func onLivenessPassed(imageData: Data) {
    onSuccess?(imageData)
    dismiss(animated: true)
  }

  public func onFailure(reason: String) {
    let callback = onFailureCallback
    dismiss(animated: true) {
      callback?(reason)
    }
  }

  public func onFaceDetected(boundingBox: CGRect?) {}

  public func onFaceInOval(inside: Bool, reason: String?) {
    onFaceInOvalCallback?(inside, reason)
  }

  static func create(modelUrl: String?, sounds: LivenessSoundOptions?, config: LivenessConfig = LivenessConfig(), onSuccess: @escaping (Data) -> Void, onFailure: @escaping (String) -> Void) -> LivenessViewController {
    let vc = LivenessViewController()
    vc.modelUrl = modelUrl
    vc.sounds = sounds
    vc.configToApply = config
    vc.onSuccess = onSuccess
    vc.onFailureCallback = onFailure
    vc.modalPresentationStyle = .fullScreen
    return vc
  }
}
