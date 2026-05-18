import AVFoundation
import UIKit
import LivenessDetection

/// Embedded liveness: drop the LivenessView into a slot inside your own UI.
/// Host owns the page chrome, instructions, and Start button; the SDK only
/// shows camera + face frame + progress ring inside the slot.
final class EmbedViewController: UIViewController, LivenessDetectorDelegate {
  private let heading = UILabel()
  private let subtitle = UILabel()
  private let slot = UIView()
  private let statusLabel = UILabel()
  private let startButton = UIButton(type: .system)
  private let livenessView = LivenessView()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 1.0, green: 0.831, blue: 0.0, alpha: 1.0)

    heading.text = "Match your BVN photo."
    heading.font = .systemFont(ofSize: 32, weight: .heavy)
    heading.textColor = UIColor(white: 0.067, alpha: 1)
    heading.numberOfLines = 0
    heading.textAlignment = .center

    subtitle.text = "A quick selfie to match against your BVN photo. Make sure you are in a well-lit room."
    subtitle.font = .systemFont(ofSize: 14, weight: .regular)
    subtitle.textColor = UIColor(white: 0.067, alpha: 0.7)
    subtitle.numberOfLines = 0
    subtitle.textAlignment = .center

    slot.backgroundColor = UIColor(red: 0.357, green: 0.204, blue: 0.839, alpha: 1.0)
    slot.layer.cornerRadius = 140
    slot.clipsToBounds = true

    let config = LivenessConfig()
    config.shape = "circle"
    config.showInstructions = false
    config.minSize = 240
    config.progressColor = UIColor(red: 0.102, green: 0.059, blue: 0.302, alpha: 1.0) // #1A0F4D
    config.progressErrorColor = UIColor(red: 1, green: 0.231, blue: 0.231, alpha: 1.0)
    config.progressWidth = 4
    config.overlayColor = UIColor(red: 0.357, green: 0.204, blue: 0.839, alpha: 1.0)
    config.overlayErrorColor = UIColor(red: 0.7, green: 0, blue: 0, alpha: 0.6)
    livenessView.config = config
    livenessView.delegate = self

    statusLabel.text = "Tap start when you're ready."
    statusLabel.font = .systemFont(ofSize: 14, weight: .medium)
    statusLabel.textColor = UIColor(white: 0.067, alpha: 0.7)
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 0

    startButton.setTitle("Start", for: .normal)
    startButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
    startButton.setTitleColor(.white, for: .normal)
    startButton.backgroundColor = UIColor(red: 0.102, green: 0.059, blue: 0.302, alpha: 1.0)
    startButton.layer.cornerRadius = 28
    startButton.addTarget(self, action: #selector(startTapped), for: .touchUpInside)

    for v in [heading, subtitle, slot, statusLabel, startButton, livenessView] {
      v.translatesAutoresizingMaskIntoConstraints = false
    }

    view.addSubview(heading)
    view.addSubview(subtitle)
    view.addSubview(slot)
    slot.addSubview(livenessView)
    view.addSubview(statusLabel)
    view.addSubview(startButton)

    NSLayoutConstraint.activate([
      heading.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 32),
      heading.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      heading.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

      subtitle.topAnchor.constraint(equalTo: heading.bottomAnchor, constant: 12),
      subtitle.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 48),
      subtitle.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -48),

      slot.topAnchor.constraint(equalTo: subtitle.bottomAnchor, constant: 32),
      slot.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      slot.widthAnchor.constraint(equalToConstant: 280),
      slot.heightAnchor.constraint(equalToConstant: 280),

      livenessView.topAnchor.constraint(equalTo: slot.topAnchor),
      livenessView.bottomAnchor.constraint(equalTo: slot.bottomAnchor),
      livenessView.leadingAnchor.constraint(equalTo: slot.leadingAnchor),
      livenessView.trailingAnchor.constraint(equalTo: slot.trailingAnchor),

      statusLabel.topAnchor.constraint(equalTo: slot.bottomAnchor, constant: 20),
      statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

      startButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -32),
      startButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      startButton.widthAnchor.constraint(equalToConstant: 220),
      startButton.heightAnchor.constraint(equalToConstant: 56),
    ])
  }

  @objc private func startTapped() {
    startButton.isEnabled = false
    statusLabel.text = "Preparing camera…"
    requestCameraThenStart()
  }

  private func requestCameraThenStart() {
    let status = AVCaptureDevice.authorizationStatus(for: .video)
    switch status {
    case .authorized:
      livenessView.start()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        DispatchQueue.main.async {
          if granted { self?.livenessView.start() }
          else { self?.statusLabel.text = "Camera permission required" }
        }
      }
    default:
      statusLabel.text = "Camera permission required (enable in Settings)"
      startButton.isEnabled = true
    }
  }

  override func viewWillDisappear(_ animated: Bool) {
    livenessView.stop()
    super.viewWillDisappear(animated)
  }

  // ── LivenessDetectorDelegate ────────────────────────────────────────────

  func onChallengeChanged(stepIndex: Int, stepLabel: String) {
    statusLabel.text = stepIndex == -1 ? "Hold still — capturing…" : stepLabel
  }

  func onFaceInOval(inside: Bool, reason: String?) {
    if !inside { statusLabel.text = reason ?? "Centre your face in the circle" }
  }

  func onLivenessPassed(imageData: Data) {
    statusLabel.text = "Verified (\(imageData.count) bytes)"
    startButton.isEnabled = true
    startButton.setTitle("Start again", for: .normal)
  }

  func onFailure(reason: String) {
    let friendly: String
    if LivenessErrorCodes.isOffline(reason) {
      friendly = "You're offline. Check your connection."
    } else if LivenessErrorCodes.isCdnNotAvailable(reason) {
      friendly = "Couldn't load resources. Try again."
    } else {
      friendly = "Failed: \(reason)"
    }
    statusLabel.text = friendly
    startButton.isEnabled = true
    startButton.setTitle("Try again", for: .normal)
  }

  func onFaceDetected(boundingBox: CGRect?) {}
}
