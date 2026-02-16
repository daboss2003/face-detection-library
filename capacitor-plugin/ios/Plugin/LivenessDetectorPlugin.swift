import Foundation
import Capacitor
import AVFoundation
import LivenessDetection

@objc(LivenessDetectorPlugin)
public class LivenessDetectorPlugin: CAPPlugin {
  private var pendingCall: CAPPluginCall?

  @objc func startLiveness(_ call: CAPPluginCall) {
    let modelUrl = call.getString("modelUrl")
    let soundBaseUrl = call.getString("soundBaseUrl")
    let sounds = soundBaseUrl.map { LivenessSoundOptions(baseUrl: $0) }

    let status = AVCaptureDevice.authorizationStatus(for: .video)
    switch status {
    case .authorized:
      presentLiveness(call: call, modelUrl: modelUrl, sounds: sounds)
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        DispatchQueue.main.async {
          if granted {
            self?.presentLiveness(call: call, modelUrl: modelUrl, sounds: sounds)
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
    pendingCall = nil
    call.resolve()
  }

  private func presentLiveness(call: CAPPluginCall, modelUrl: String?, sounds: LivenessSoundOptions?) {
    guard let host = bridge?.viewController else {
      call.reject("No view controller")
      return
    }
    pendingCall = call
    LivenessDetector.presentLiveness(
      from: host,
      modelUrl: modelUrl,
      sounds: sounds,
      onSuccess: { [weak self] data in
        guard let call = self?.pendingCall else { return }
        call.resolve(["imageBase64": data.base64EncodedString()])
        self?.pendingCall = nil
      },
      onFailure: { [weak self] reason in
        self?.notifyListeners("failure", data: ["reason": reason])
        self?.pendingCall?.reject(reason)
        self?.pendingCall = nil
      }
    )
  }
}
