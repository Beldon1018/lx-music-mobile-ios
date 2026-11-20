import { AppState, NativeModules, Dimensions } from 'react-native'

const Native = (NativeModules as any).IOSUtils

/**
 * iOS 系统工具适配层
 * 对应 Android 版 src/utils/nativeModules/utils.ts
 * - 砍掉：installApk / getSupportedAbis / 电池优化（用户确认不需要）
 * - 用 JS/跨平台实现：窗口尺寸、屏幕状态、系统语言
 */
export const exitApp = () => {
  // iOS 规范无主动退出，移到后台
  Native?.exitApp?.()
}

export const getSupportedAbis = async(): Promise<string[]> => ['arm64']

export const installApk = async() => { /* iOS 不支持应用内安装，已砍掉 */ }

export const screenkeepAwake = () => Native?.screenkeepAwake?.()
export const screenUnkeepAwake = () => Native?.screenUnkeepAwake?.()

export const getWIFIIPV4Address = async(): Promise<string> => Native?.getWIFIIPV4Address?.() ?? '0.0.0.0'

export const getDeviceName = async(): Promise<string> => Native?.getDeviceName?.() ?? 'iOS Device'

export const isNotificationsEnabled = async(): Promise<boolean> => Native?.isNotificationsEnabled?.() ?? false

export const requestNotificationPermission = async(): Promise<boolean> => Native?.openNotificationPermissionActivity?.() ?? false

export const shareText = async(shareTitle: string, title: string, text: string): Promise<void> => {
  Native?.shareText?.(shareTitle, title, text)
}

export const getSystemLocales = async(): Promise<string> => {
  if (Native?.getSystemLocales) return Native.getSystemLocales()
  const settings = (NativeModules as any).SettingsManager?.settings
  return settings?.AppleLocale ?? settings?.AppleLanguages?.[0] ?? 'zh-CN'
}

// iOS 无精确屏幕开关广播，用 AppState 近似（active/background）
export const onScreenStateChange = (handler: (state: 'ON' | 'OFF') => void): () => void => {
  const sub = AppState.addEventListener('change', state => {
    handler(state === 'active' ? 'ON' : 'OFF')
  })
  return () => sub.remove()
}

export const getWindowSize = async(): Promise<{ width: number, height: number }> => {
  if (Native?.getWindowSize) return Native.getWindowSize()
  const { width, height } = Dimensions.get('window')
  return { width, height }
}

export const onWindowSizeChange = (handler: (size: { width: number, height: number }) => void): () => void => {
  const sub = Dimensions.addEventListener('change', ({ window }) => {
    handler({ width: window.width, height: window.height })
  })
  return () => sub.remove()
}

// iOS 无电池优化概念（已砍掉），返回 true 表示"无需处理"
export const isIgnoringBatteryOptimization = async(): Promise<boolean> => true
export const requestIgnoreBatteryOptimization = async(): Promise<boolean> => true
