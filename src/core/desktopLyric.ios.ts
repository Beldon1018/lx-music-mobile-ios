/**
 * iOS 桌面歌词适配层
 *
 * 对应 Android 版 src/core/desktopLyric.ts（悬浮窗歌词）。
 * iOS 无跨应用悬浮窗，改为：灵动岛 Live Activity + 锁屏歌词。
 *
 * 保持与 Android 版相同的导出符号，使上层 core/lyric.ts、
 * core/init/player/lyric.ts 无需任何改动。
 */
import { NativeModules, AppState, AppStateStatus } from 'react-native'
import {
  setLyric as lrcSetLyric,
  play as lrcPlay,
  pause as lrcPause,
  addPlayHook,
  removePlayHook,
  addSetLyricHook,
  removeSetLyricHook,
  type Lines,
} from '@/plugins/lyric'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'

const LiveActivity = (NativeModules as any).IOSLiveActivity

type LinePlayHandler = (info: { text: string, extendedLyrics: string[] }) => void
const linePlayHandlers: LinePlayHandler[] = []
let currentLines: Lines = []
let activityActive = false

// 当前句索引，用于计算上下文
const findLineIndex = (text: string): number => {
  if (!text) return -1
  return currentLines.findIndex(line => line.text === text)
}

const buildState = (text: string, extendedLyrics: string[] = []) => {
  const music = playerState.musicInfo
  const idx = findLineIndex(text)
  const prevLyric = idx > 0 ? (currentLines[idx - 1]?.text ?? '') : ''
  const nextLyric = idx >= 0 && idx < currentLines.length - 1 ? (currentLines[idx + 1]?.text ?? '') : ''
  return {
    title: music.name ?? '',
    artist: music.singer ?? '',
    currentLyric: text || (music.name ?? ''),
    prevLyric,
    nextLyric: extendedLyrics[0] ?? nextLyric,
    isPlaying: playerState.isPlay,
    albumArtBase64: '', // 封面需要压缩到极小尺寸，后续可从 musicInfo.thumbnail 加载缩放
  }
}

const safeStart = async() => {
  if (!LiveActivity || activityActive) return
  try {
    const supported = await LiveActivity.isSupported()
    if (!supported) return
    await LiveActivity.start(buildState(''))
    activityActive = true
  } catch { /* 灵动岛不可用时静默降级 */ }
}

const safeUpdate = (text: string, extendedLyrics: string[] = []) => {
  if (!LiveActivity) return
  if (!activityActive) { void safeStart().then(() => { void LiveActivity.update(buildState(text, extendedLyrics)) }); return }
  void LiveActivity.update(buildState(text, extendedLyrics)).catch(() => {})
}

const safeEnd = () => {
  if (!LiveActivity || !activityActive) return
  void LiveActivity.end().catch(() => {})
  activityActive = false
}

// 注册歌词行 hook：每次歌词切换推送到灵动岛
const playHook = (line: number, text: string) => {
  const lineData = currentLines[line]
  const extendedLyrics: string[] = lineData?.extendedLyrics?.length ? [...lineData.extendedLyrics] : []
  for (const handler of linePlayHandlers) handler({ text, extendedLyrics })
  if (settingState.setting['desktopLyric.enable']) safeUpdate(text, extendedLyrics)
}
const setLyricHook = (lines: Lines) => { currentLines = lines }

addPlayHook(playHook)
addSetLyricHook(setLyricHook)

// App 进入后台/前台时管理 Live Activity
AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state === 'background') {
    // 播放中保持灵动岛歌词；暂停时结束
    if (!playerState.isPlay) safeEnd()
  }
})

// ---- 与 Android 版一致的导出符号 ----

export const showDesktopLyric = async() => {
  if (!LiveActivity) return
  const supported = await LiveActivity.isSupported()
  if (!supported) throw new Error('当前设备不支持灵动岛歌词')
  await safeStart()
  lrcSetLyric(playerState.musicInfo.lrc ?? '', playerState.musicInfo.tlrc ?? '', playerState.musicInfo.rlrc ?? '')
  if (playerState.isPlay) lrcPlay(0)
}

export const hideDesktopLyric = async() => safeEnd()

export const playDesktopLyric = (time: number) => {
  lrcPlay(time)
  if (!activityActive) void safeStart()
}
export const pauseDesktopLyric = () => { lrcPause(); safeUpdate('') }
export const setDesktopLyric = (lyric: string, translation?: string, romalrc?: string) => {
  lrcSetLyric(lyric, translation, romalrc)
}
export const setDesktopLyricPlaybackRate = async(_rate: number) => { /* JS 歌词插件自行处理 */ }
export const toggleDesktopLyricTranslation = async(_isShow: boolean) => { /* JS 歌词插件处理 */ }
export const toggleDesktopLyricRoma = async(_isShow: boolean) => { /* JS 歌词插件处理 */ }
export const toggleDesktopLyricLock = async() => {}
export const setDesktopLyricColor = async() => {}
export const setDesktopLyricAlpha = async() => {}
export const setShowDesktopLyricToggleAnima = async() => {}
export const setDesktopLyricSingleLine = async() => {}
export const setDesktopLyricMaxLineNum = async() => {}
export const setDesktopLyricWidth = async() => {}
export const setDesktopLyricTextSize = async() => {}
export const setDesktopLyricTextPosition = async() => {}
export const checkDesktopLyricOverlayPermission = async() => { /* iOS 无需悬浮窗权限 */ }
export const openDesktopLyricOverlayPermissionActivity = async() => {}
export const onDesktopLyricPositionChange = (_handler: (position: { x: number, y: number }) => void) => () => {}

export const onLyricLinePlay = (handler: LinePlayHandler) => {
  linePlayHandlers.push(handler)
  return () => {
    const idx = linePlayHandlers.indexOf(handler)
    if (idx >= 0) linePlayHandlers.splice(idx, 1)
  }
}

// 释放 hook（模块卸载时）
export const destroy = () => {
  removePlayHook(playHook)
  removeSetLyricHook(setLyricHook)
  safeEnd()
}

export const showRemoteLyric = async(_isSend: boolean) => { /* 蓝牙歌词 iOS 无对应，no-op */ }
