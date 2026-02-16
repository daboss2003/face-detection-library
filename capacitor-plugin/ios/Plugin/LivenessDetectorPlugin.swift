import Foundation
import Capacitor
import AVFoundation
import LivenessDetection

@objc(LivenessDetectorPlugin)
public class LivenessDetectorPlugin: CAPPlugin, LivenessDetectorDelegate {
  private var detector: LivenessDetector?
  private var pendingCall: CAPPluginCall?
  private var overlayView: UIView?

  @objc func startLiveness(_ call: CAPPluginCall) {
    let modelUrl = call.getString("modelUrl") ??
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    let status = AVCaptureDevice.authorizationStatus(for: .video)
    switch status {
    case .authorized:
      startInternal(call, modelUrl: modelUrl)
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { granted in
        DispatchQueue.main.async {
          if granted {
            self.startInternal(call, modelUrl: modelUrl)
          } else {
            call.reject("Camera permission denied")
          }
        }
      }
    default:
      call.reject("Camera permission denied")
    }
  }

  @objc func stop(_ call: CAPPluginCall) {
    stopInternal()
    call.resolve()
  }

  private func startInternal(_ call: CAPPluginCall, modelUrl: String?) {
    stopInternal()
    pendingCall = call

    guard let rootView = bridge?.viewController?.view else {
      call.reject("No root view")
      return
    }

    let preview = UIView(frame: rootView.bounds)
    preview.backgroundColor = .clear
    rootView.addSubview(preview)
    overlayView = preview

    detector = LivenessDetector(delegate: self)
    if let modelUrl, !modelUrl.isEmpty {
      detector?.startLiveness(previewView: preview, useFrontCamera: true, modelUrl: modelUrl)
    } else {
      detector?.startLiveness(previewView: preview, useFrontCamera: true)
    }
  }

  private func stopInternal() {
    detector?.stop()
    detector = nil
    overlayView?.removeFromSuperview()
    overlayView = nil
    pendingCall = nil
  }

  public func onChallengeChanged(stepIndex: Int, stepLabel: String) {
    notifyListeners("challengeChanged", data: [
      "stepIndex": stepIndex,
      "stepLabel": stepLabel
    ])
  }

  public func onLivenessPassed(imageData: Data) {
    guard let call = pendingCall else { return }
    call.resolve([
      "imageBase64": imageData.base64EncodedString()
    ])
    pendingCall = nil
    stopInternal()
  }

  public func onFailure(reason: String) {
    notifyListeners("failure", data: [
      "reason": reason
    ])
    pendingCall?.reject(reason)
    pendingCall = nil
    stopInternal()
  }

  public func onFaceInOval(inside: Bool, reason: String?) {
    var data: [AnyHashable: Any] = ["inside": inside]
    if let reason { data["reason"] = reason }
    notifyListeners("faceInOval", data: data)
  }
}
