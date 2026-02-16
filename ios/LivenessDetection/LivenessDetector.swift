import Foundation
import UIKit
import MediaPipeTasksVision

@objc public protocol LivenessDetectorDelegate: AnyObject {
  func onChallengeChanged(stepIndex: Int, stepLabel: String)
  func onLivenessPassed(imageData: Data)
  func onFailure(reason: String)
  func onFaceDetected(boundingBox: CGRect?)
  func onFaceInOval(inside: Bool, reason: String?)
}

public extension LivenessDetectorDelegate {
  func onFaceDetected(boundingBox: CGRect?) {}
  func onFaceInOval(inside: Bool, reason: String?) {}
}

@objc public final class LivenessDetector: NSObject {
  private static let defaultModelUrl =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
  private let config: LivenessConfig
  private weak var delegate: LivenessDetectorDelegate?
  private var steps: [LivenessStep]
  private var stateMachine: LivenessStateMachine
  private var cameraService: CameraService?
  private var landmarker: FaceLandmarkerPipeline?
  private var latestMetrics: FaceMetrics?
  private var captureScheduled = false
  private var captureActive = false
  private var captureAttempts = 0
  private var captureDelayWorkItem: DispatchWorkItem?
  private var sessionTimeoutWorkItem: DispatchWorkItem?
  private var lastOvalState: Bool?
  private let workQueue = DispatchQueue(label: "com.liveness.detector.queue")

  @objc public init(
    config: LivenessConfig = LivenessConfig(),
    modelPath: String? = nil,
    delegate: LivenessDetectorDelegate
  ) {
    self.config = config
    self.delegate = delegate
    self.steps = LivenessStep.allCases
    self.stateMachine = LivenessStateMachine(config: config, steps: self.steps)
    self.modelPath = modelPath
  }

  @objc public convenience init(delegate: LivenessDetectorDelegate) {
    self.init(config: LivenessConfig(), modelPath: nil, delegate: delegate)
  }

  private var modelPath: String?

  @objc public func startLiveness(previewView: UIView?, useFrontCamera: Bool = true) {
    if let localPath = modelPath, !localPath.isEmpty {
      startInternal(previewView: previewView, useFrontCamera: useFrontCamera, modelPath: localPath)
      return
    }
    startLiveness(previewView: previewView, useFrontCamera: useFrontCamera, modelUrl: Self.defaultModelUrl)
  }

  @objc public func startLiveness(previewView: UIView?, useFrontCamera: Bool = true, modelUrl: String) {
    guard let url = URL(string: modelUrl) else {
      delegate?.onFailure(reason: "Invalid model URL")
      return
    }
    ModelDownloader.fetch(url: url) { [weak self] result in
      DispatchQueue.main.async {
        guard let self else { return }
        switch result {
        case .success(let fileUrl):
          self.startInternal(previewView: previewView, useFrontCamera: useFrontCamera, modelPath: fileUrl.path)
        case .failure(let error):
          self.delegate?.onFailure(reason: "Model download failed: \(error.localizedDescription)")
        }
      }
    }
  }

  private func startInternal(previewView: UIView?, useFrontCamera: Bool, modelPath: String?) {
    stop()
    let nowMs = nowMilliseconds()
    steps = buildSteps()
    stateMachine = LivenessStateMachine(config: config, steps: steps)
    stateMachine.reset(nowMs: nowMs)
    delegate?.onChallengeChanged(
      stepIndex: 0,
      stepLabel: steps.first?.label ?? ""
    )
    startSessionTimeout()

    let camera = CameraService(previewView: previewView, cameraPosition: useFrontCamera ? .front : .back)
    camera.delegate = self
    cameraService = camera

    let pipeline = FaceLandmarkerPipeline(config: config)
    pipeline.delegate = self
    landmarker = pipeline

    let path = modelPath ?? ""
    if path.isEmpty {
      delegate?.onFailure(reason: "Model path required")
      return
    }
    pipeline.setup(modelPath: path)
    camera.start()
  }

  @objc public func stop() {
    captureScheduled = false
    captureActive = false
    captureAttempts = 0
    captureDelayWorkItem?.cancel()
    captureDelayWorkItem = nil
    sessionTimeoutWorkItem?.cancel()
    sessionTimeoutWorkItem = nil
    cameraService?.stop()
    cameraService = nil
    landmarker = nil
    latestMetrics = nil
    lastOvalState = nil
  }

  private func scheduleCapture() {
    if captureScheduled { return }
    captureScheduled = true
    captureActive = false
    captureAttempts = 0
    delegate?.onChallengeChanged(stepIndex: -1, stepLabel: "Relax and look at the camera")

    captureDelayWorkItem?.cancel()
    let workItem = DispatchWorkItem { [weak self] in
      self?.captureActive = true
    }
    captureDelayWorkItem = workItem
    workQueue.asyncAfter(deadline: .now() + .milliseconds(Int(config.captureDelayMs)), execute: workItem)
  }

  private func attemptCapture(metrics: FaceMetrics) {
    captureAttempts += 1
    let headFrontal = abs(metrics.yaw) <= config.captureMaxYaw &&
      abs(metrics.pitch) <= config.captureMaxPitch
    let eyesOpen = metrics.blinkScore > 0
      ? metrics.blinkScore < config.captureMaxBlinkScore
      : metrics.avgEar >= config.captureMinEar
    let mouthClosed = metrics.mouthScore > 0
      ? metrics.mouthScore < config.captureMaxMouthScore
      : metrics.mouthMar < config.captureMaxMar

    if headFrontal && eyesOpen && mouthClosed {
      captureActive = false
      cameraService?.capturePhoto(onSuccess: { data in
        self.delegate?.onLivenessPassed(imageData: data)
        self.stop()
      }, onFailure: { error in
        self.delegate?.onFailure(reason: error)
        self.stop()
      })
      return
    }

    if captureAttempts >= config.captureMaxAttempts {
      delegate?.onFailure(reason: "Please look straight at the camera with a relaxed expression.")
      stop()
    }
  }

  private func checkFaceInOval(
    metrics: FaceMetrics,
    isHeadTurnStep: Bool
  ) -> (Bool, String?) {
    let dy = (metrics.faceCy - config.ovalCy) / config.ovalRy
    let dx = (metrics.faceCx - config.ovalCx) / config.ovalRx

    let inEllipse: Bool
    if isHeadTurnStep {
      inEllipse = abs(dy) <= 1
    } else {
      inEllipse = dx * dx + dy * dy <= 1
    }

    if !inEllipse {
      let reason: String
      if abs(dy) >= abs(dx) {
        reason = dy < 0 ? "Move down slightly" : "Move up slightly"
      } else {
        reason = dx < 0 ? "Move right" : "Move left"
      }
      return (false, reason)
    }

    if metrics.faceSize < config.minFaceSize {
      return (false, "Move closer to the camera")
    }
    if metrics.faceSize > config.maxFaceSize {
      return (false, "Move back a little")
    }

    return (true, nil)
  }

  private func buildSteps() -> [LivenessStep] {
    var list = Array(LivenessStep.allCases)
    if config.shuffleSteps { list.shuffle() }
    return list
  }

  private func startSessionTimeout() {
    sessionTimeoutWorkItem?.cancel()
    let workItem = DispatchWorkItem { [weak self] in
      DispatchQueue.main.async {
        self?.delegate?.onFailure(reason: "Timed out. Please try again.")
        self?.stop()
      }
    }
    sessionTimeoutWorkItem = workItem
    workQueue.asyncAfter(deadline: .now() + .milliseconds(Int(config.sessionTimeoutMs)), execute: workItem)
  }

  private func nowMilliseconds() -> Int64 {
    return Int64(Date().timeIntervalSince1970 * 1000)
  }
}

extension LivenessDetector: CameraServiceDelegate {
  func cameraService(_ service: CameraService, didOutput sampleBuffer: CMSampleBuffer, orientation: UIImage.Orientation, timestampMs: Int64) {
    landmarker?.process(sampleBuffer: sampleBuffer, orientation: orientation, timestampMs: timestampMs)
  }

  func cameraServiceDidFail(_ service: CameraService, reason: String) {
    delegate?.onFailure(reason: reason)
    stop()
  }
}

extension LivenessDetector: FaceLandmarkerPipelineDelegate {
  func faceLandmarkerPipeline(_ pipeline: FaceLandmarkerPipeline, didOutput result: FaceLandmarkerResult, imageSize: CGSize) {
    guard let metrics = FaceMetricsExtractor.extract(result: result, imageSize: imageSize) else {
      if lastOvalState != false {
        lastOvalState = false
        delegate?.onFaceInOval(inside: false, reason: "No face detected")
      }
      return
    }
    latestMetrics = metrics
    delegate?.onFaceDetected(boundingBox: metrics.boundingBox)
    let currentStep = (!captureScheduled && !steps.isEmpty) ? stateMachine.currentStep() : nil
    let isHeadTurnStep = currentStep == .turnLeft || currentStep == .turnRight
    let (insideOval, reason) = currentStep != nil
      ? checkFaceInOval(metrics: metrics, isHeadTurnStep: isHeadTurnStep)
      : (true, nil)
    if insideOval != lastOvalState {
      lastOvalState = insideOval
      delegate?.onFaceInOval(inside: insideOval, reason: reason)
    }

    if captureActive {
      attemptCapture(metrics: metrics)
      return
    }

    if !insideOval { return }

    let update = stateMachine.update(metrics: metrics, nowMs: metrics.timestampMs, insideOval: true)
    switch update {
    case .none:
      break
    case .stepChanged(let stepIndex, let stepLabel):
      delegate?.onChallengeChanged(stepIndex: stepIndex, stepLabel: stepLabel)
    case .failed(let reason):
      delegate?.onFailure(reason: reason)
      stop()
    case .passed:
      scheduleCapture()
    }
  }

  func faceLandmarkerPipeline(_ pipeline: FaceLandmarkerPipeline, didFail error: String) {
    delegate?.onFailure(reason: error)
    stop()
  }
}
