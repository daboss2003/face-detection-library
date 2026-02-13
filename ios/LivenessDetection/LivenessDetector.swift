import Foundation
import UIKit
import MediaPipeTasksVision

@objc public protocol LivenessDetectorDelegate: AnyObject {
  func onChallengeChanged(stepIndex: Int, stepLabel: String)
  func onLivenessPassed(imageData: Data)
  func onFailure(reason: String)
  func onFaceDetected(boundingBox: CGRect?)
}

public extension LivenessDetectorDelegate {
  func onFaceDetected(boundingBox: CGRect?) {}
}

@objc public final class LivenessDetector: NSObject {
  private let config: LivenessConfig
  private weak var delegate: LivenessDetectorDelegate?
  private var stateMachine: LivenessStateMachine
  private var cameraService: CameraService?
  private var landmarker: FaceLandmarkerPipeline?
  private var latestMetrics: FaceMetrics?
  private var captureScheduled = false
  private let workQueue = DispatchQueue(label: "com.liveness.detector.queue")

  @objc public init(
    config: LivenessConfig = LivenessConfig(),
    modelPath: String? = nil,
    delegate: LivenessDetectorDelegate
  ) {
    self.config = config
    self.delegate = delegate
    self.stateMachine = LivenessStateMachine(config: config)
    self.modelPath = modelPath
  }

  @objc public convenience init(delegate: LivenessDetectorDelegate) {
    self.init(config: LivenessConfig(), modelPath: nil, delegate: delegate)
  }

  private var modelPath: String?

  @objc public func startLiveness(previewView: UIView?, useFrontCamera: Bool = true) {
    startInternal(previewView: previewView, useFrontCamera: useFrontCamera, modelPath: resolveModelPath())
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
    stateMachine.reset(nowMs: nowMs)
    delegate?.onChallengeChanged(
      stepIndex: LivenessStep.allCases.first?.rawValue ?? 0,
      stepLabel: LivenessStep.allCases.first?.label ?? ""
    )

    let camera = CameraService(previewView: previewView, cameraPosition: useFrontCamera ? .front : .back)
    camera.delegate = self
    cameraService = camera

    let pipeline = FaceLandmarkerPipeline(config: config)
    pipeline.delegate = self
    landmarker = pipeline

    let path = modelPath ?? ""
    if path.isEmpty {
      delegate?.onFailure(reason: "face_landmarker.task not found")
      return
    }
    pipeline.setup(modelPath: path)
    camera.start()
  }

  @objc public func stop() {
    captureScheduled = false
    cameraService?.stop()
    cameraService = nil
    landmarker = nil
    latestMetrics = nil
  }

  private func scheduleCapture() {
    if captureScheduled { return }
    captureScheduled = true
    let delay = DispatchTime.now() + .milliseconds(Int(config.captureDelayMs))
    workQueue.asyncAfter(deadline: delay) { [weak self] in
      guard let self else { return }
      guard let metrics = self.latestMetrics else {
        self.delegate?.onFailure(reason: "No face available for capture")
        self.stop()
        return
      }
      if abs(metrics.yaw) > self.config.frontalYawThreshold ||
        abs(metrics.pitch) > self.config.frontalPitchThreshold ||
        metrics.avgEar < self.config.blinkOpenThreshold {
        self.delegate?.onFailure(reason: "Final check failed (frontal + eyes open required)")
        self.stop()
        return
      }

      self.cameraService?.capturePhoto(onSuccess: { data in
        self.delegate?.onLivenessPassed(imageData: data)
        self.stop()
      }, onFailure: { error in
        self.delegate?.onFailure(reason: error)
        self.stop()
      })
    }
  }

  private func resolveModelPath() -> String? {
    if let provided = modelPath { return provided }
    let bundle = Bundle(for: LivenessDetector.self)
    return bundle.path(forResource: "face_landmarker", ofType: "task")
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
    guard let metrics = FaceMetricsExtractor.extract(result: result, imageSize: imageSize) else { return }
    latestMetrics = metrics
    delegate?.onFaceDetected(boundingBox: metrics.boundingBox)
    let update = stateMachine.update(metrics: metrics, nowMs: metrics.timestampMs)
    switch update {
    case .none:
      break
    case .stepChanged(let step):
      delegate?.onChallengeChanged(stepIndex: step.rawValue, stepLabel: step.label)
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
