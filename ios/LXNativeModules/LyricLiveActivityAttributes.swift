import Foundation
import ActivityKit

/// 灵动岛歌词实时活动的数据模型
/// 主 App 与 Widget Extension 共享此文件（Target Membership 需同时勾选两个 target）
public struct LyricLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String          // 歌曲名
        var artist: String         // 歌手
        var currentLyric: String   // 当前歌词句
        var prevLyric: String      // 上一句
        var nextLyric: String      // 下一句
        var isPlaying: Bool
        var albumArtBase64: String // 封面（小尺寸 base64，受 4KB 限制）

        public init(title: String = "", artist: String = "", currentLyric: String = "",
                    prevLyric: String = "", nextLyric: String = "", isPlaying: Bool = true,
                    albumArtBase64: String = "") {
            self.title = title
            self.artist = artist
            self.currentLyric = currentLyric
            self.prevLyric = prevLyric
            self.nextLyric = nextLyric
            self.isPlaying = isPlaying
            self.albumArtBase64 = albumArtBase64
        }
    }

    public init() {}
}
