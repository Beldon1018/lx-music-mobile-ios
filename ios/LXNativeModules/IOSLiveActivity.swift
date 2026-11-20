import Foundation
import ActivityKit

@objc(IOSLiveActivity)
class IOSLiveActivity: NSObject {
    private var currentActivity: Activity<LyricLiveActivityAttributes>?

    @objc static func requiresMainQueueSetup() -> Bool { return false }

    @objc func isSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
        } else {
            resolve(false)
        }
    }

    @objc func start(_ state: [String: Any],
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.1, *) else {
            resolve(nil)
            return
        }
        let contentState = Self.makeState(from: state)
        let attributes = LyricLiveActivityAttributes()
        do {
            // 若已有活动先结束，避免多个实例竞争灵动岛
            awaitMain {
                for activity in Activity<LyricLiveActivityAttributes>.activities {
                    Task { await activity.end(dismissalPolicy: .immediate) }
                }
            }
            let activity = try Activity.request(attributes: attributes,
                                                content: ActivityContent(state: contentState, staleDate: nil),
                                                pushType: nil)
            self.currentActivity = activity
            resolve(true)
        } catch {
            reject(@"LA_START_FAILED", error.localizedDescription, error)
        }
    }

    @objc func update(_ state: [String: Any],
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.1, *) else { resolve(nil); return }
        let target = self.currentActivity ?? Activity<LyricLiveActivityAttributes>.activities.first
        guard let activity = target else { resolve(false); return }
        let contentState = Self.makeState(from: state)
        Task {
            await activity.update(ActivityContent(state: contentState, staleDate: nil))
            resolve(true)
        }
    }

    @objc func end(_ resolver: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.1, *) else { resolve(nil); return }
        let target = self.currentActivity ?? Activity<LyricLiveActivityAttributes>.activities.first
        guard let activity = target else { resolve(false); return }
        Task {
            await activity.end(dismissalPolicy: .default)
            resolve(true)
        }
        self.currentActivity = nil
    }

    private static func makeState(from dict: [String: Any]) -> LyricLiveActivityAttributes.ContentState {
        return LyricLiveActivityAttributes.ContentState(
            title: dict["title"] as? String ?? "",
            artist: dict["artist"] as? String ?? "",
            currentLyric: dict["currentLyric"] as? String ?? "",
            prevLyric: dict["prevLyric"] as? String ?? "",
            nextLyric: dict["nextLyric"] as? String ?? "",
            isPlaying: dict["isPlaying"] as? Bool ?? true,
            albumArtBase64: dict["albumArtBase64"] as? String ?? ""
        )
    }

    private func awaitMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread { block() }
        else { DispatchQueue.main.sync(execute: block) }
    }
}
