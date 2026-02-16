import Foundation
import AVFoundation

final class LivenessSoundPlayer {
  private let options: LivenessSoundOptions?
  private var player: AVAudioPlayer?
  private let queue = DispatchQueue(label: "com.liveness.sound")

  init(options: LivenessSoundOptions?) {
    self.options = options
  }

  func url(forKey key: String) -> String? {
    options?.url(forKey: key)
  }

  func play(key: String, onEnded: (() -> Void)? = nil) {
    guard let urlString = url(forKey: key), !urlString.isEmpty else {
      onEnded?()
      return
    }
    queue.async { [weak self] in
      guard let self else { return }
      let url: URL?
      if urlString.hasPrefix("http://") || urlString.hasPrefix("https://") {
        url = URL(string: urlString)
      } else if urlString.hasPrefix("file://") {
        url = URL(string: urlString)
      } else {
        url = URL(fileURLWithPath: urlString)
      }
      guard let playUrl = url else {
        DispatchQueue.main.async { onEnded?() }
        return
      }
      do {
        let player = try AVAudioPlayer(contentsOf: playUrl)
        self.player = player
        player.play()
        DispatchQueue.main.async {
          DispatchQueue.main.asyncAfter(deadline: .now() + player.duration + 0.05) {
            self.player = nil
            onEnded?()
          }
        }
      } catch {
        DispatchQueue.main.async { onEnded?() }
      }
    }
  }

  func stop() {
    queue.async { [weak self] in
      self?.player?.stop()
      self?.player = nil
    }
  }
}
