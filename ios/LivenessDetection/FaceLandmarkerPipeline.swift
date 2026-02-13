import Foundation
import MediaPipeTasksVision
import AVFoundation
import UIKit

protocol FaceLandmarkerPipelineDelegate: AnyObject {
  func faceLandmarkerPipeline(_ pipeline: FaceLandmarkerPipeline, didOutput result: FaceLandmarkerResult, imageSize: CGSize)
  func faceLandmarkerPipeline(_ pipeline: FaceLandmarkerPipeline, didFail error: String)
}

final class FaceLandmarkerPipeline: NSObject {
  private let config: LivenessConfig
  private var faceLandmarker: FaceLandmarker?
  private var lastImageSize: CGSize = .zero
  weak var delegate: FaceLandmarkerPipelineDelegate?

  init(config: LivenessConfig) {
    self.config = config
    super.init()
  }

  func setup(modelPath: String) {
    let options = FaceLandmarkerOptions()
    options.runningMode = .liveStream
    options.numFaces = 1
    options.minFaceDetectionConfidence = config.faceDetectionConfidence
    options.minFacePresenceConfidence = config.facePresenceConfidence
    options.minTrackingConfidence = config.faceTrackingConfidence
    options.outputFaceBlendshapes = true
    options.outputFacialTransformationMatrixes = true
    options.baseOptions.modelAssetPath = modelPath
    options.faceLandmarkerLiveStreamDelegate = self

    do {
      faceLandmarker = try FaceLandmarker(options: options)
    } catch {
      delegate?.faceLandmarkerPipeline(self, didFail: "FaceLandmarker init failed: \(error.localizedDescription)")
    }
  }

  func process(sampleBuffer: CMSampleBuffer, orientation: UIImage.Orientation, timestampMs: Int64) {
    guard let mpImage = try? MPImage(sampleBuffer: sampleBuffer, orientation: orientation) else {
      return
    }
    if let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) {
      let width = CVPixelBufferGetWidth(pixelBuffer)
      let height = CVPixelBufferGetHeight(pixelBuffer)
      lastImageSize = CGSize(width: width, height: height)
    }
    do {
      try faceLandmarker?.detectAsync(image: mpImage, timestampInMilliseconds: timestampMs)
    } catch {
      delegate?.faceLandmarkerPipeline(self, didFail: "FaceLandmarker detect failed: \(error.localizedDescription)")
    }
  }
}

extension FaceLandmarkerPipeline: FaceLandmarkerLiveStreamDelegate {
  func faceLandmarker(
    _ faceLandmarker: FaceLandmarker,
    didFinishDetection result: FaceLandmarkerResult?,
    timestampInMilliseconds: Int64,
    error: Error?
  ) {
    if let error = error {
      delegate?.faceLandmarkerPipeline(self, didFail: "FaceLandmarker error: \(error.localizedDescription)")
      return
    }
    guard let result = result else { return }
    delegate?.faceLandmarkerPipeline(self, didOutput: result, imageSize: lastImageSize)
  }
}
