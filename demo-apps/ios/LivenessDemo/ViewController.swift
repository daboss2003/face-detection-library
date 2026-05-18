import UIKit
import LivenessDetection

final class ViewController: UIViewController {
  private let startButton = UIButton(type: .system)
  private let statusLabel = UILabel()
  private let embedButton = UIButton(type: .system)

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground

    startButton.setTitle("Start verification", for: .normal)
    startButton.translatesAutoresizingMaskIntoConstraints = false
    startButton.addTarget(self, action: #selector(startTapped), for: .touchUpInside)

    statusLabel.text = "Tap to start liveness (SDK-owned UI)"
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 0
    statusLabel.translatesAutoresizingMaskIntoConstraints = false

    embedButton.setTitle("Try embedded demo", for: .normal)
    embedButton.translatesAutoresizingMaskIntoConstraints = false
    embedButton.addTarget(self, action: #selector(embedTapped), for: .touchUpInside)

    view.addSubview(startButton)
    view.addSubview(statusLabel)
    view.addSubview(embedButton)

    NSLayoutConstraint.activate([
      startButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      startButton.centerYAnchor.constraint(equalTo: view.centerYAnchor),

      statusLabel.topAnchor.constraint(equalTo: startButton.bottomAnchor, constant: 16),
      statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

      embedButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 32),
      embedButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
    ])
  }

  @objc private func embedTapped() {
    let vc = EmbedViewController()
    vc.modalPresentationStyle = .fullScreen
    present(vc, animated: true)
  }

  @objc private func startTapped() {
    statusLabel.text = "Starting..."

    // Example: per-key sounds + a few tuned thresholds. Pass defaults for web-SDK parity.
    let sounds = LivenessSoundOptions(baseUrl: nil)
    let config = LivenessConfig()
    config.shuffleSteps = true
    config.yawTurnDelta = 9

    LivenessDetector.presentLiveness(
      from: self,
      modelUrl: nil,
      sounds: sounds,
      config: config,
      onChallengeChanged: { [weak self] stepIndex, stepLabel in
        self?.statusLabel.text = "Step \(stepIndex + 1): \(stepLabel)"
      },
      onFaceInOval: { _, _ in },
      onSuccess: { [weak self] data in
        self?.statusLabel.text = "Liveness passed (\(data.count) bytes)"
      },
      onFailure: { [weak self] reason in
        let friendly: String
        if LivenessErrorCodes.isOffline(reason) {
          friendly = "You're offline. Check your internet connection."
        } else if LivenessErrorCodes.isCdnNotAvailable(reason) {
          friendly = "Unable to reach the model host. Please try again later."
        } else {
          friendly = "Failed: \(reason)"
        }
        self?.statusLabel.text = friendly
      }
    )
  }
}
