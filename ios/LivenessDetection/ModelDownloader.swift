import Foundation

enum ModelDownloadError: Error {
  case invalidUrl
  case fileMoveFailed
}

final class ModelDownloader {
  static func fetch(url: URL, completion: @escaping (Result<URL, Error>) -> Void) {
    let destination = cachedFileUrl(for: url)
    if FileManager.default.fileExists(atPath: destination.path) {
      completion(.success(destination))
      return
    }

    let task = URLSession.shared.downloadTask(with: url) { tempUrl, _, error in
      if let error = error {
        completion(.failure(error))
        return
      }
      guard let tempUrl = tempUrl else {
        completion(.failure(ModelDownloadError.fileMoveFailed))
        return
      }

      do {
        let directory = destination.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: destination.path) {
          try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: tempUrl, to: destination)
        completion(.success(destination))
      } catch {
        completion(.failure(error))
      }
    }
    task.resume()
  }

  private static func cachedFileUrl(for url: URL) -> URL {
    let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let fileName = url.lastPathComponent.isEmpty ? "face_landmarker.task" : url.lastPathComponent
    return appSupport.appendingPathComponent("liveness-models").appendingPathComponent(fileName)
  }
}
