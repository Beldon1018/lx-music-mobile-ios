import SwiftUI
import WidgetKit
import ActivityKit

/// 灵动岛歌词 Widget Extension
/// 提供 compact / minimal / expanded / 锁屏 四种呈现
struct LyricWidget: Widget {
    let kind: String = "LyricWidget"

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LyricLiveActivityAttributes.self) { context in
            // 锁屏呈现
            LockScreenLyricView(state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // 长按展开
                DynamicIslandExpandedRegion(.leading) {
                    albumArt(state: context.state)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.state.title)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(context.state.currentLyric)
                            .font(.headline)
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .multilineTextAlignment(.center)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Image(systemName: context.state.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.prevLyric).font(.caption2).foregroundStyle(.gray).lineLimit(1)
                        Spacer()
                        Text(context.state.nextLyric).font(.caption2).foregroundStyle(.gray).lineLimit(1)
                    }
                    .padding(.horizontal, 8)
                }
            } compactLeading: {
                // 紧凑态左侧：封面
                albumArt(state: context.state)
            } compactTrailing: {
                // 紧凑态右侧：当前歌词（短句）
                Text(context.state.currentLyric)
                    .font(.caption2)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .frame(maxWidth: 100)
            } minimal: {
                // 多个活动时：播放状态图标
                Image(systemName: context.state.isPlaying ? "music.note" : "pause.fill")
                    .foregroundStyle(.white)
            }
            .widgetURL(URL(string: "lxmusic://playdetail"))
            .keylineTint(Color.purple)
        }
    }

    @ViewBuilder
    private func albumArt(state: LyricLiveActivityAttributes.ContentState) -> some View {
        if !state.albumArtBase64.isEmpty,
           let data = Data(base64Encoded: state.albumArtBase64),
           let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 28, height: 28)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        } else {
            Image(systemName: "music.note")
                .foregroundStyle(.purple)
                .frame(width: 28, height: 28)
        }
    }
}

struct LockScreenLyricView: View {
    let state: LyricLiveActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            if !state.albumArtBase64.isEmpty,
               let data = Data(base64Encoded: state.albumArtBase64),
               let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
                    .frame(width: 54, height: 54).clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                Image(systemName: "music.note").font(.title)
                    .foregroundStyle(.purple)
                    .frame(width: 54, height: 54)
                    .background(Color.white.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(state.currentLyric)
                    .font(.headline).foregroundStyle(.white).lineLimit(2)
                Text("\(state.title) - \(state.artist)")
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Image(systemName: state.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                .font(.title2).foregroundStyle(.white)
        }
        .padding(12)
    }
}

@main
struct LyricWidgetBundle: WidgetBundle {
    var body: some Widget {
        LyricWidget()
    }
}
