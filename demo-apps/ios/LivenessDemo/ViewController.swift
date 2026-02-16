import UIKit
import LivenessDetection

final class ViewController: UIViewController {
  private let startButton = UIButton(type: .system)
  private let statusLabel = UILabel()

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

    view.addSubview(startButton)
    view.addSubview(statusLabel)

    NSLayoutConstraint.activate([
      startButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      startButton.centerYAnchor.constraint(equalTo: view.centerYAnchor),

      statusLabel.topAnchor.constraint(equalTo: startButton.bottomAnchor, constant: 16),
      statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
    ])
  }

  @objc private func startTapped() {
    statusLabel.text = "Starting..."
    LivenessDetector.presentLiveness(
      from: self,
      modelUrl: nil,
      sounds: nil,
      onSuccess: { [weak self] data in
        self?.statusLabel.text = "Liveness passed (\(data.count) bytes)"
      },
      onFailure: { [weak self] reason in
        self?.statusLabel.text = "Failed: \(reason)"
      }
    )
  }
}
