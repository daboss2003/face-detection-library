import UIKit

/// Embeddable liveness view. Add to any view hierarchy, assign `delegate`,
/// optionally tune `config` / `sounds` / `modelUrl`, then call `start()`.
///
/// - Full-bleed: add with autoresizing or constraints filling the container.
/// - Embed in a slot (e.g. a circular UI region): set `config.showInstructions = false`
///   so the host owns text and buttons. Sounds keep playing.
///
/// Camera permission must be granted by the host before calling `start()`.
@objc public final class LivenessView: UIView, LivenessDetectorDelegate {

  private let previewView = UIView()
  private let overlayView = LivenessOvalOverlayView()
  private let instructionLabel = UILabel()
  private let posHintLabel = UILabel()
  private let hintView = LivenessHintView()

  private var detector: LivenessDetector?

  /// Tuning + UI options. Reassign at any time to update theme/shape/visibility.
  @objc public var config: LivenessConfig = LivenessConfig() {
    didSet { applyConfig() }
  }
  /// Per-step sounds (left/blink/right/nod/mouth/good/capture).
  @objc public var sounds: LivenessSoundOptions?
  /// Override the MediaPipe Face Landmarker model URL. Defaults to Google's hosted float16 model.
  @objc public var modelUrl: String?
  /// Callbacks for the host. Invoked on the main thread.
  @objc public weak var delegate: LivenessDetectorDelegate?

  override public init(frame: CGRect) {
    super.init(frame: frame)
    setup()
  }

  public required init?(coder: NSCoder) {
    super.init(coder: coder)
    setup()
  }

  private func setup() {
    backgroundColor = .black

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

    addSubview(previewView)
    addSubview(overlayView)
    addSubview(instructionLabel)
    addSubview(posHintLabel)
    addSubview(hintView)

    NSLayoutConstraint.activate([
      previewView.topAnchor.constraint(equalTo: topAnchor),
      previewView.bottomAnchor.constraint(equalTo: bottomAnchor),
      previewView.leadingAnchor.constraint(equalTo: leadingAnchor),
      previewView.trailingAnchor.constraint(equalTo: trailingAnchor),

      overlayView.topAnchor.constraint(equalTo: topAnchor),
      overlayView.bottomAnchor.constraint(equalTo: bottomAnchor),
      overlayView.leadingAnchor.constraint(equalTo: leadingAnchor),
      overlayView.trailingAnchor.constraint(equalTo: trailingAnchor),

      instructionLabel.topAnchor.constraint(equalTo: topAnchor, constant: 18),
      instructionLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
      instructionLabel.trailingAnchor.constraint(equalTo: trailingAnchor),

      posHintLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
      posHintLabel.centerYAnchor.constraint(equalTo: centerYAnchor, constant: 40),

      hintView.centerXAnchor.constraint(equalTo: centerXAnchor),
      hintView.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -80),
      hintView.widthAnchor.constraint(equalToConstant: 52),
      hintView.heightAnchor.constraint(equalToConstant: 52),
    ])

    applyConfig()
  }

  private func applyConfig() {
    overlayView.applyStyle(config)
    let show = config.showInstructions
    instructionLabel.isHidden = !show
    hintView.isHidden = !show
    if !show { posHintLabel.isHidden = true }
    posHintLabel.textColor = config.progressErrorColor
  }

  /// Begin liveness. Camera permission must be granted by the host.
  @objc public func start() {
    stop()
    if config.showInstructions {
      instructionLabel.text = "Position your face in the oval"
    }
    let det = LivenessDetector(config: config, delegate: self, sounds: sounds)
    detector = det
    det.startLiveness(previewView: previewView, useFrontCamera: true, modelUrl: modelUrl ?? LivenessDetector.defaultModelURL)
  }

  /// Stop detection and release the camera. Safe to call repeatedly.
  @objc public func stop() {
    detector?.stop()
    detector = nil
  }

  // ── LivenessDetectorDelegate (internal — updates UI then forwards) ────────

  public func onChallengeChanged(stepIndex: Int, stepLabel: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if self.config.showInstructions {
        self.instructionLabel.text = stepLabel
      }
      if stepIndex >= 0 {
        self.overlayView.setProgress(stepIndex)
        self.overlayView.setStepDots(activeIndex: stepIndex)
        self.hintView.setHint(stepLabel: stepLabel)
      } else {
        self.overlayView.setProgress(5)
        self.overlayView.setStepDots(activeIndex: 5)
        self.hintView.setHint(stepLabel: nil)
      }
      self.delegate?.onChallengeChanged(stepIndex: stepIndex, stepLabel: stepLabel)
    }
  }

  public func onLivenessPassed(imageData: Data) {
    DispatchQueue.main.async { [weak self] in
      self?.delegate?.onLivenessPassed(imageData: imageData)
    }
  }

  public func onFailure(reason: String) {
    DispatchQueue.main.async { [weak self] in
      self?.delegate?.onFailure(reason: reason)
    }
  }

  public func onFaceDetected(boundingBox: CGRect?) {
    delegate?.onFaceDetected(boundingBox: boundingBox)
  }

  public func onFaceInOval(inside: Bool, reason: String?) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.overlayView.setFaceInOval(inside)
      if self.config.showInstructions {
        self.posHintLabel.isHidden = inside
        self.posHintLabel.text = reason ?? ""
      }
      self.delegate?.onFaceInOval(inside: inside, reason: reason)
    }
  }
}
