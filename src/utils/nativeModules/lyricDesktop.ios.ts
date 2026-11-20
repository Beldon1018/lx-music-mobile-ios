import { NativeModules } from 'react-native'

/**
 * iOS 桌面歌词原生模块适配层
 * 对应 Android 版 src/utils/nativeModules/lyricDesktop.ts（悬浮窗）
 *
 * iOS 无悬浮窗，实际歌词能力由 @/core/desktopLyric.ios.ts 通过灵动岛 Live Activity 实现。
 * 本文件仅提供符号兼容，避免直接 import 它的上层（如 core/common.ts）报错。
 */

const LiveActivity = (NativeModules as any).IOSLiveActivity

export const showDesktopLyricView = async(_options: Record<string, unknown>) => {
  try {
    if (LiveActivity && await LiveActivity.isSupported()) await LiveActivity.start({})
  } catch { /* 静默降级 */ }
}
export const hideDesktopLyricView = async() => {
  try { await LiveActivity?.end?.() } catch { /* noop */ }
}
export const setSendLyricTextEvent = async(_isSend: boolean) => {}
export const setLyric = async(_lrc: string, _tlrc?: string, _rlrc?: string) => {}
export const play = async(_time: number) => {}
export const pause = async() => {}
export const stop = async() => {}
export const setPlaybackRate = async(_rate: number) => {}
export const toggleTranslation = async(_isShow: boolean) => {}
export const toggleRoma = async(_isShow: boolean) => {}
export const toggleLock = async() => {}
export const setColor = async() => {}
export const setAlpha = async(_alpha: number) => {}
export const setTextSize = async(_size: number) => {}
export const setShowToggleAnima = async(_isShow: boolean) => {}
export const setSingleLine = async(_isSingle: boolean) => {}
export const setPosition = async() => {}
export const setMaxLineNum = async(_num: number) => {}
export const setWidth = async(_width: number) => {}
export const setLyricTextPosition = async() => {}
export const checkOverlayPermission = async() => {}
export const openOverlayPermissionActivity = async() => {}
export const onPositionChange = (_handler: (position: { x: number, y: number }) => void) => () => {}
export const onLyricLinePlay = (_handler: (info: { text: string, extendedLyrics: string[] }) => void) => () => {}
