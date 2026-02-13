import AVFoundation
import UIKit

protocol CameraServiceDelegate: AnyObject {
  func cameraService(_ service: CameraService, didOutput sampleBuffer: CMSampleBuffer, orientation: UIImage.Orientation, timestampMs: Int64)
  func cameraServiceDidFail(_ service: CameraService, reason: String)
}

final class CameraService: NSObject {
  private let session = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "com.liveness.camera.session")
  private let outputQueue = DispatchQueue(label: "com.liveness.camera.output")
  private let videoOutput = AVCaptureVideoDataOutput()
  private let photoOutput = AVCapturePhotoOutput()
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private let cameraPosition: AVCaptureDevice.Position
  private var photoDelegate: PhotoCaptureDelegate?

  weak var delegate: CameraServiceDelegate?

  init(previewView: UIView?, cameraPosition: AVCaptureDevice.Position = .front) {
    self.cameraPosition = cameraPosition
    super.init()
    session.sessionPreset = .high
    if let previewView = previewView {
      let layer = AVCaptureVideoPreviewLayer(session: session)
      layer.videoGravity = .resizeAspectFill
      layer.frame = previewView.bounds
      previewView.layer.addSublayer(layer)
      previewLayer = layer
    }
  }

  func start() {
    sessionQueue.async {
      self.configureSession()
      self.session.startRunning()
    }
  }

  func stop() {
    sessionQueue.async {
      if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  func updatePreviewFrame(_ frame: CGRect) {
    DispatchQueue.main.async {
      self.previewLayer?.frame = frame
    }
  }

  func capturePhoto(onSuccess: @escaping (Data) -> Void, onFailure: @escaping (String) -> Void) {
    let settings = AVCapturePhotoSettings()
    settings.isHighResolutionPhotoEnabled = true
    let delegate = PhotoCaptureDelegate(
      onSuccess: { data in
        self.photoDelegate = nil
        onSuccess(data)
      },
      onFailure: { error in
        self.photoDelegate = nil
        onFailure(error)
      }
    )
    photoDelegate = delegate
    photoOutput.capturePhoto(with: settings, delegate: delegate)
  }

  private func configureSession() {
    session.beginConfiguration()
    defer { session.commitConfiguration() }

    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: cameraPosition) else {
      delegate?.cameraServiceDidFail(self, reason: "Camera not available")
      return
    }

    do {
      let input = try AVCaptureDeviceInput(device: device)
      if session.canAddInput(input) {
        session.addInput(input)
      }
    } catch {
      delegate?.cameraServiceDidFail(self, reason: "Camera input error: \(error.localizedDescription)")
      return
    }

    videoOutput.alwaysDiscardsLateVideoFrames = true
    videoOutput.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ]
    videoOutput.setSampleBufferDelegate(self, queue: outputQueue)
    if session.canAddOutput(videoOutput) {
      session.addOutput(videoOutput)
      if let connection = videoOutput.connection(with: .video), cameraPosition == .front {
        connection.isVideoMirrored = true
      }
    }

    if session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
      photoOutput.isHighResolutionCaptureEnabled = true
    }
  }
}

extension CameraService: AVCaptureVideoDataOutputSampleBufferDelegate {
  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let orientation = UIImage.Orientation.from(deviceOrientation: UIDevice.current.orientation)
    let timestampMs = Int64(CACurrentMediaTime() * 1000)
    delegate?.cameraService(self, didOutput: sampleBuffer, orientation: orientation, timestampMs: timestampMs)
  }
}

extension UIImage.Orientation {
  static func from(deviceOrientation: UIDeviceOrientation) -> UIImage.Orientation {
    switch deviceOrientation {
    case .portrait:
      return .up
    case .landscapeLeft:
      return .left
    case .landscapeRight:
      return .right
    default:
      return .up
    }
  }
}

final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
  private let onSuccess: (Data) -> Void
  private let onFailure: (String) -> Void

  init(onSuccess: @escaping (Data) -> Void, onFailure: @escaping (String) -> Void) {
    self.onSuccess = onSuccess
    self.onFailure = onFailure
  }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    if let error = error {
      onFailure("Photo capture error: \(error.localizedDescription)")
      return
    }
    guard let data = photo.fileDataRepresentation() else {
      onFailure("Photo data unavailable")
      return
    }
    onSuccess(data)
  }
}
