import { btoa, toByteArray } from 'react-native-quick-base64'
import { stringMd5 } from 'react-native-quick-md5'
import preloadScript from '@/assets/script/user-api-preload'
import { aesEncryptSync, rsaEncryptSync, RSA_PADDING, AES_MODE } from '@/utils/nativeModules/crypto'

/**
 * iOS 用户脚本引擎（JS 层实现，替代 Android 的 QuickJS 原生引擎）
 *
 * Android 用 QuickJS + 一组 __lx_native_call__ 原生函数运行用户脚本。
 * iOS 上 RN 自带 JSC/Hermes，复用同一份 preload 脚本 + JS 实现的原生函数，
 * 即可获得完全一致的脚本 API，无需引入 QuickJS。
 * 使用 sandbox（遮蔽 globalThis）隔离脚本，避免污染主 App 全局，且支持重复加载。
 */

// 与 userApi.ts 导出的类型保持一致
export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: { statusCode: number, statusMessage: string, headers: Record<string, string>, body: any } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}

export interface InitParams { status: boolean, errorMessage: string, info: LX.UserApi.UserApiInfo }
export interface ResponseParams { status: boolean, errorMessage?: string, requestKey: string, result: any }
export interface UpdateInfoParams { name: string, log: string, updateUrl: string }
export interface RequestParams {
  requestKey: string
  url: string
  options: { method: string, data: any, timeout: number, headers: any, binary: boolean }
}
export type CancelRequestParams = string
export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K] } }[keyof Actions]

type Handler = (event: ActionsEvent) => void
const handlers: Handler[] = []
let currentKey: string | null = null
let sandbox: any = null
let loadInfo: (LX.UserApi.UserApiInfo & { script: string }) | null = null

const emit = (action: keyof Actions, data: any) => {
  let eventData = data
  if (data && typeof data === 'object') {
    if (action === 'init') {
      eventData = { ...data, info: data.info ? { ...loadInfo, ...data.info } : { ...loadInfo } }
    } else if (action === 'showUpdateAlert' && !loadInfo?.allowShowUpdateAlert) {
      return
    }
  }
  for (const h of handlers) h({ action, data: eventData } as ActionsEvent)
}

const createSandbox = (key: string) => {
  const g: any = Object.create(null)
  // 脚本 → RN（经 preload 的 __lx_native_call__）
  g.__lx_native_call__ = (k: string, action: string, dataStr: string) => {
    if (k !== key) return
    let data: any = dataStr
    try { data = JSON.parse(dataStr) } catch { /* keep string */ }
    emit(action as keyof Actions, data)
  }
  g.__lx_native_call__utils_str2b64 = (str: string) => {
    try { return btoa(unescape(encodeURIComponent(str))) } catch { return '' }
  }
  g.__lx_native_call__utils_b642buf = (str: string) => {
    try { return JSON.stringify(Array.from(toByteArray(str, true)).map(b => b < 0 ? b + 256 : b)) } catch { return '' }
  }
  g.__lx_native_call__utils_str2md5 = (str: string) => {
    try { return stringMd5(decodeURIComponent(str)) } catch { return '' }
  }
  g.__lx_native_call__utils_aes_encrypt = (data: string, k2: string, vi: string, mode: string) => {
    try { return aesEncryptSync(data, k2, vi, mode as AES_MODE) } catch { return '' }
  }
  g.__lx_native_call__utils_rsa_encrypt = (data: string, k2: string, padding: string) => {
    try { return rsaEncryptSync(data, k2, padding as RSA_PADDING) } catch { return '' }
  }
  g.__lx_native_call__set_timeout = (cb: (...args: any[]) => void, timeout: number) => setTimeout(cb, timeout)
  // 常用全局（脚本运行环境所需）
  g.console = console
  g.JSON = JSON
  g.Math = Math
  g.Date = Date
  g.Uint8Array = Uint8Array
  g.ArrayBuffer = ArrayBuffer
  g.TextEncoder = TextEncoder
  g.TextDecoder = TextDecoder
  g.setTimeout = setTimeout
  g.clearTimeout = clearTimeout
  g.decodeURIComponent = decodeURIComponent
  g.encodeURIComponent = encodeURIComponent
  return g
}

// 以 sandbox 作为 globalThis 执行（函数参数遮蔽全局 globalThis）
const evaluate = (code: string, g: any) => {
  // eslint-disable-next-line no-new-func
  new Function('globalThis', code)(g)
}

export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  loadInfo = info
  currentKey = info.id
  const g = createSandbox(info.id)
  sandbox = g
  try {
    evaluate(preloadScript, g)
    evaluate(info.script, g)
    // 用户脚本若未自行调用 lx_setup，则这里补调用完成初始化
    if (typeof g.lx_setup === 'function') {
      g.lx_setup(info.id, info.id, info.name, info.description ?? '', info.version ?? '',
        info.author ?? '', info.homepage ?? '', info.script)
    }
  } catch (err: any) {
    emit('log', `脚本加载失败: ${err?.message ?? err}`)
    emit('init', { status: false, errorMessage: err?.message ?? 'load failed', info })
  }
}

export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T]) => {
  if (!currentKey || !sandbox || typeof sandbox.__lx_native__ !== 'function') return
  try {
    sandbox.__lx_native__(currentKey, action, JSON.stringify(data))
  } catch (err: any) {
    emit('log', `sendAction(${action}) 失败: ${err?.message ?? err}`)
  }
}

export const onScriptAction = (handler: Handler): (() => void) => {
  handlers.push(handler)
  return () => {
    const idx = handlers.indexOf(handler)
    if (idx >= 0) handlers.splice(idx, 1)
  }
}

export const destroy = () => {
  sandbox = null
  handlers.length = 0
  currentKey = null
  loadInfo = null
}
