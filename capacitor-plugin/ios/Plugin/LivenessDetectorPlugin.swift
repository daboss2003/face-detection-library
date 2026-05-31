import Foundation
import Capacitor
import AVFoundation
import LivenessDetection

@objc(LivenessDetectorPlugin)
public class LivenessDetectorPlugin: CAPPlugin {
  private var pendingCall: CAPPluginCall?

  @objc func startLiveness(_ call: CAPPluginCall) {
    let modelUrl = call.getString("modelUrl")
    let sounds = parseSounds(call: call)
    let config = parseConfig(call: call)

    let status = AVCaptureDevice.authorizationStatus(for: .video)
    switch status {
    case .authorized:
      presentLiveness(call: call, modelUrl: modelUrl, sounds: sounds, config: config)
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        DispatchQueue.main.async {
          if granted {
            self?.presentLiveness(call: call, modelUrl: modelUrl, sounds: sounds, config: config)
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

  private func parseSounds(call: CAPPluginCall) -> LivenessSoundOptions? {
    // Prefer nested `sounds` object; fall back to top-level `soundBaseUrl`.
    if let dict = call.getObject("sounds") {
      return LivenessSoundOptions(
        baseUrl: dict["baseUrl"] as? String,
        left: dict["left"] as? String,
        blink: dict["blink"] as? String,
        right: dict["right"] as? String,
        nod: dict["nod"] as? String,
        mouth: dict["mouth"] as? String,
        good: dict["good"] as? String,
        capture: dict["capture"] as? String
      )
    }
    if let base = call.getString("soundBaseUrl") {
      return LivenessSoundOptions(baseUrl: base)
    }
    return nil
  }

  private func parseConfig(call: CAPPluginCall) -> LivenessConfig {
    let config = LivenessConfig()
    guard let dict = call.getObject("config") else { return config }

    func f(_ key: String) -> Float? { (dict[key] as? NSNumber)?.floatValue }
    func cg(_ key: String) -> CGFloat? { (dict[key] as? NSNumber).map { CGFloat($0.doubleValue) } }
    func i64(_ key: String) -> Int64? { (dict[key] as? NSNumber)?.int64Value }
    func i(_ key: String) -> Int? { (dict[key] as? NSNumber)?.intValue }
    func b(_ key: String) -> Bool? { dict[key] as? Bool }
    func s(_ key: String) -> String? { dict[key] as? String }
    func color(_ key: String) -> UIColor? { colorFromHexString(dict[key]) }

    if let v = i64("readyMs") { config.readyMs = v }
    if let v = i64("sessionTimeoutMs") { config.sessionTimeoutMs = v }
    if let v = i("baselineFrames") { config.baselineFrames = v }
    if let v = f("yawTurnDelta") { config.yawTurnDelta = v }
    if let v = f("yawWrongDirDelta") { config.yawWrongDirDelta = v }
    if let v = i64("headTurnHoldMs") { config.headTurnHoldMs = v }
    if let v = f("nodDownDelta") { config.nodDownDelta = v }
    if let v = f("nodReturnFraction") { config.nodReturnFraction = v }
    if let v = f("nodReturnMaxDelta") { config.nodReturnMaxDelta = v }
    if let v = f("blinkClosedThreshold") { config.blinkClosedThreshold = v }
    if let v = f("blinkOpenThreshold") { config.blinkOpenThreshold = v }
    if let v = f("earClosedThreshold") { config.earClosedThreshold = v }
    if let v = f("earOpenThreshold") { config.earOpenThreshold = v }
    if let v = i64("blinkMaxDurationMs") { config.blinkMaxDurationMs = v }
    if let v = f("mouthOpenThreshold") { config.mouthOpenThreshold = v }
    if let v = f("mouthOpenMarThreshold") { config.mouthOpenMarThreshold = v }
    if let v = i64("mouthHoldMs") { config.mouthHoldMs = v }
    if let v = f("maxYawDuringBlink") { config.maxYawDuringBlink = v }
    if let v = f("maxPitchDuringBlink") { config.maxPitchDuringBlink = v }
    if let v = f("maxYawDuringNod") { config.maxYawDuringNod = v }
    if let v = f("maxYawDuringMouth") { config.maxYawDuringMouth = v }
    if let v = f("maxPitchDuringMouth") { config.maxPitchDuringMouth = v }
    if let v = f("ovalCx") { config.ovalCx = v }
    if let v = f("ovalCy") { config.ovalCy = v }
    if let v = f("ovalRx") { config.ovalRx = v }
    if let v = f("ovalRy") { config.ovalRy = v }
    if let v = f("minFaceSize") { config.minFaceSize = v }
    if let v = f("maxFaceSize") { config.maxFaceSize = v }
    if let v = i64("captureDelayMs") { config.captureDelayMs = v }
    if let v = i("captureMaxAttempts") { config.captureMaxAttempts = v }
    if let v = f("captureMaxYaw") { config.captureMaxYaw = v }
    if let v = f("captureMaxPitch") { config.captureMaxPitch = v }
    if let v = f("captureMaxMouthScore") { config.captureMaxMouthScore = v }
    if let v = f("captureMaxBlinkScore") { config.captureMaxBlinkScore = v }
    if let v = f("captureMinEar") { config.captureMinEar = v }
    if let v = f("captureMaxMar") { config.captureMaxMar = v }
    if let v = b("shuffleSteps") { config.shuffleSteps = v }
    if let v = dict["steps"] as? [Any] {
      config.steps = v.compactMap { $0 as? String }
    }
    if let v = i("cdnMaxRetries") { config.cdnMaxRetries = v }
    if let v = i64("cdnAttemptTimeoutMs") { config.cdnAttemptTimeoutMs = v }
    if let v = i64("connectivityCheckTimeoutMs") { config.connectivityCheckTimeoutMs = v }

    // UI / theme
    if let v = s("shape") { config.shape = v }
    if let v = b("showInstructions") { config.showInstructions = v }
    if let v = cg("minSize") { config.minSize = v }
    if let v = cg("progressWidth") { config.progressWidth = v }
    if let v = s("progressLineCap") { config.progressLineCap = v }
    if let v = color("progressColor") { config.progressColor = v }
    if let v = color("progressErrorColor") { config.progressErrorColor = v }
    if let v = color("overlayColor") { config.overlayColor = v }
    if let v = color("overlayErrorColor") { config.overlayErrorColor = v }

    return config
  }

  private func colorFromHexString(_ value: Any?) -> UIColor? {
    guard let raw = value as? String else { return nil }
    let trim = raw.replacingOccurrences(of: "#", with: "")
    var hex: UInt64 = 0
    guard Scanner(string: trim).scanHexInt64(&hex) else { return nil }
    let r, g, b, a: CGFloat
    if trim.count == 8 {                       // AARRGGBB
      a = CGFloat((hex >> 24) & 0xFF) / 255
      r = CGFloat((hex >> 16) & 0xFF) / 255
      g = CGFloat((hex >> 8)  & 0xFF) / 255
      b = CGFloat( hex        & 0xFF) / 255
    } else {                                    // RRGGBB
      a = 1
      r = CGFloat((hex >> 16) & 0xFF) / 255
      g = CGFloat((hex >> 8)  & 0xFF) / 255
      b = CGFloat( hex        & 0xFF) / 255
    }
    return UIColor(red: r, green: g, blue: b, alpha: a)
  }

  private func presentLiveness(
    call: CAPPluginCall,
    modelUrl: String?,
    sounds: LivenessSoundOptions?,
    config: LivenessConfig
  ) {
    guard let host = bridge?.viewController else {
      call.reject("No view controller")
      return
    }
    pendingCall = call
    LivenessDetector.presentLiveness(
      from: host,
      modelUrl: modelUrl,
      sounds: sounds,
      config: config,
      onChallengeChanged: { [weak self] stepIndex, stepLabel in
        self?.notifyListeners("challengeChanged", data: ["stepIndex": stepIndex, "stepLabel": stepLabel])
      },
      onFaceInOval: { [weak self] inside, reason in
        var data: [String: Any] = ["inside": inside]
        if let reason = reason { data["reason"] = reason }
        self?.notifyListeners("faceInOval", data: data)
      },
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
