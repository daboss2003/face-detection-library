import Foundation

enum ModelDownloadError: Error {
  case invalidUrl
  case fileMoveFailed
}

final class ModelDownloader {
  private static let connectivityCheckUrl = URL(string: "https://www.gstatic.com/generate_204")!

  static func fetch(
    url: URL,
    maxAttempts: Int = 5,
    attemptTimeoutMs: Int64 = 45_000,
    connectivityCheckTimeoutMs: Int64 = 5_000,
    completion: @escaping (Result<URL, Error>) -> Void
  ) {
    let destination = cachedFileUrl(for: url)
    if FileManager.default.fileExists(atPath: destination.path) {
      completion(.success(destination))
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      for attempt in 1...maxAttempts {
        switch downloadOnce(url: url, destination: destination, timeoutMs: attemptTimeoutMs) {
        case .success:
          completion(.success(destination)); return
        case .retriable:
          if attempt == 1, !checkConnectivity(timeoutMs: connectivityCheckTimeoutMs) {
            completion(.failure(LivenessError(code: LivenessErrorCodes.offline, message: "No internet connection")))
            return
          }
        case .fatal(let error):
          completion(.failure(error))
          return
        }
      }
      completion(.failure(LivenessError(
        code: LivenessErrorCodes.cdnNotAvailable,
        message: "CDN not available. Please try again later."
      )))
    }
  }

  private enum DownloadResult {
    case success
    case retriable
    case fatal(Error)
  }

  private static func downloadOnce(url: URL, destination: URL, timeoutMs: Int64) -> DownloadResult {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = TimeInterval(timeoutMs) / 1000.0
    config.timeoutIntervalForResource = TimeInterval(timeoutMs) / 1000.0
    let session = URLSession(configuration: config)
    let semaphore = DispatchSemaphore(value: 0)
    var outcome: DownloadResult = .retriable

    let task = session.downloadTask(with: url) { tempUrl, response, error in
      defer { semaphore.signal() }
      if error != nil {
        outcome = .retriable
        return
      }
      guard let tempUrl = tempUrl else {
        outcome = .retriable
        return
      }
      if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
        outcome = [404, 500, 502, 503].contains(http.statusCode) ? .retriable : .fatal(
          LivenessError(code: "httpError", message: "HTTP \(http.statusCode)")
        )
        return
      }
      do {
        let directory = destination.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: destination.path) {
          try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: tempUrl, to: destination)
        outcome = .success
      } catch {
        outcome = .fatal(error)
      }
    }
    task.resume()
    semaphore.wait()
    return outcome
  }

  private static func checkConnectivity(timeoutMs: Int64) -> Bool {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = TimeInterval(timeoutMs) / 1000.0
    config.timeoutIntervalForResource = TimeInterval(timeoutMs) / 1000.0
    let session = URLSession(configuration: config)
    var request = URLRequest(url: connectivityCheckUrl)
    request.httpMethod = "HEAD"
    let semaphore = DispatchSemaphore(value: 0)
    var reachable = false

    let task = session.dataTask(with: request) { _, response, _ in
      if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
        reachable = true
      }
      semaphore.signal()
    }
    task.resume()
    semaphore.wait()
    return reachable
  }

  private static func cachedFileUrl(for url: URL) -> URL {
    let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let fileName = url.lastPathComponent.isEmpty ? "face_landmarker.task" : url.lastPathComponent
    return appSupport.appendingPathComponent("liveness-models").appendingPathComponent(fileName)
  }
}
