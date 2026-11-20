import RNFS from 'react-native-fs'
import { NativeModules, Platform } from 'react-native'

/**
 * iOS 文件系统适配层
 *
 * 对应 Android 版 src/utils/fs.ts。iOS 使用应用沙盒 + UIDocumentPicker，
 * 没有 Android 的 SAF / content:// / SDCardDir 概念。
 *
 * - Dirs.CacheDir      -> RNFS.CachesDirectoryPath
 * - Dirs.DocumentDir   -> RNFS.DocumentDirectoryPath
 * - Dirs.SDCardDir     -> RNFS.DocumentDirectoryPath（iOS 无外置存储，指向沙盒文档目录）
 * - AndroidScoped      -> IOSDocumentPicker 原生模块（UIDocumentPickerViewController + security-scoped bookmark）
 */

export type FileType = {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  lastModified: number
  canRead: boolean
  data: string
  mimeType: string
  size: number
}
export type Encoding = 'base64' | 'utf8'
export type HashAlgorithm = 'md5' | 'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512'
export type OpenDocumentOptions = {
  mimeTypes?: string[]
  extTypes?: string[]
  multi?: boolean
  toPath?: string
  encoding?: Encoding
}

const IOSDocumentPicker = (NativeModules as any).IOSDocumentPicker

export const extname = (name: string) => name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.') + 1) : ''

export const temporaryDirectoryPath = RNFS.CachesDirectoryPath
// iOS 无外置存储目录，指向沙盒文档目录（用户可通过文件 App 访问）
export const externalStorageDirectoryPath = RNFS.DocumentDirectoryPath
export const privateStorageDirectoryPath = RNFS.DocumentDirectoryPath

const MIME_MAP: Record<string, string> = {
  json: 'application/json', js: 'application/javascript', lxmc: 'application/octet-stream',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  txt: 'text/plain', lrc: 'text/plain', bin: 'application/octet-stream',
}
const getMimeType = (name: string) => MIME_MAP[extname(name).toLowerCase()] ?? 'application/octet-stream'

const toFileType = (item: RNFS.ReadDirItem | RNFS.StatResult): FileType => {
  const path = item.path
  const name = item.name || path.substring(path.lastIndexOf('/') + 1)
  return {
    name,
    path,
    mimeType: getMimeType(name),
    isDirectory: item.isDirectory(),
    isFile: item.isFile(),
    lastModified: item.mtime instanceof Date ? item.mtime.getTime() : Number(item.mtime ?? 0) * 1000,
    canRead: true,
    data: '',
    size: item.size ?? 0,
  }
}

// iOS 无外置存储，返回沙盒目录供目录浏览器展示
export const getExternalStoragePaths = async(_is_removable?: boolean): Promise<string[]> => [
  RNFS.DocumentDirectoryPath,
]

// 选择目录：使用 UIDocumentPicker，返回 security-scoped bookmark 路径
export const selectManagedFolder = async(isPersist: boolean = false): Promise<FileType> => {
  if (!IOSDocumentPicker) throw new Error('IOSDocumentPicker 原生模块未链接')
  const path: string = await IOSDocumentPicker.openDocumentTree(isPersist)
  const st = await RNFS.stat(path)
  return toFileType(st)
}

// 选择文件：使用 UIDocumentPicker，复制到 App 沙盒后返回路径
export const selectFile = async(options: OpenDocumentOptions): Promise<FileType> => {
  if (!IOSDocumentPicker) throw new Error('IOSDocumentPicker 原生模块未链接')
  const path: string = await IOSDocumentPicker.openDocument({
    mimeTypes: options.mimeTypes ?? [],
    extTypes: options.extTypes ?? [],
    multi: false,
    toPath: options.toPath,
  })
  const st = await RNFS.stat(path)
  return toFileType(st)
}

export const removeManagedFolder = async(path: string) => {
  if (!IOSDocumentPicker) return
  await IOSDocumentPicker.removeBookmark(path)
}

// iOS 无 SAF 持久 URI，用已保存的 bookmark 列表代替
export const getManagedFolders = async(): Promise<string[]> => {
  if (!IOSDocumentPicker) return []
  return IOSDocumentPicker.getBookmarks()
}

export const getPersistedUriList = async(): Promise<string[]> => getManagedFolders()

export const readDir = async(path: string): Promise<FileType[]> => {
  const items = await RNFS.readDir(path)
  return items.map(item => toFileType(item))
}

export const unlink = async(path: string): Promise<boolean> => {
  await RNFS.unlink(path)
  return true
}

export const mkdir = async(path: string): Promise<FileType> => {
  await RNFS.mkdir(path)
  return toFileType(await RNFS.stat(path))
}

export const stat = async(path: string): Promise<FileType> => toFileType(await RNFS.stat(path))

export const hash = async(path: string, algorithm: HashAlgorithm = 'md5'): Promise<string> => {
  // react-native-fs 的 hash 支持 md5/sha1/sha256/sha512，其余降级为 sha256
  const algo = ['md5', 'sha1', 'sha256', 'sha512'].includes(algorithm) ? algorithm : 'sha256'
  return RNFS.hash(path, algo)
}

export const readFile = async(path: string, encoding: Encoding = 'utf8'): Promise<string> =>
  RNFS.readFile(path, encoding)

export const moveFile = async(fromPath: string, toPath: string): Promise<boolean> => {
  await RNFS.moveFile(fromPath, toPath)
  return true
}

export const gzipFile = async(_fromPath: string, _toPath: string): Promise<void> => {
  throw new Error('gzipFile 在 iOS 暂未实现，请使用 gzipString')
}

export const unGzipFile = async(_fromPath: string, _toPath: string): Promise<void> => {
  throw new Error('unGzipFile 在 iOS 暂未实现，请使用 unGzipString')
}

// pako 已作为依赖引入，用 JS 处理字符串 gzip
import pako from 'pako'
export const gzipString = async(data: string, encoding: Encoding = 'utf8'): Promise<string> => {
  const bytes = encoding === 'base64'
    ? Uint8Array.from(atob(data), c => c.charCodeAt(0))
    : new TextEncoder().encode(data)
  const gz = pako.gzip(bytes)
  return encoding === 'base64' ? btoa(String.fromCharCode(...gz)) : new TextDecoder().decode(gz)
}

export const unGzipString = async(data: string, encoding: Encoding = 'utf8'): Promise<string> => {
  const bytes = encoding === 'base64'
    ? Uint8Array.from(atob(data), c => c.charCodeAt(0))
    : new TextEncoder().encode(data)
  const raw = pako.ungzip(bytes)
  return encoding === 'base64' ? btoa(String.fromCharCode(...raw)) : new TextDecoder().decode(raw)
}

export const existsFile = async(path: string): Promise<boolean> => RNFS.exists(path)

export const rename = async(path: string, name: string): Promise<boolean> => {
  const parent = path.substring(0, path.lastIndexOf('/'))
  await RNFS.moveFile(path, `${parent}/${name}`)
  return true
}

export const writeFile = async(path: string, data: string, encoding: Encoding = 'utf8'): Promise<void> =>
  RNFS.writeFile(path, data, encoding)

export const appendFile = async(path: string, data: string, encoding: Encoding = 'utf8'): Promise<void> =>
  RNFS.appendFile(path, data, encoding)

export const downloadFile = (url: string, path: string, options: Omit<RNFS.DownloadFileOptions, 'fromUrl' | 'toFile'> = {}) => {
  if (!options.headers) {
    options.headers = {
      'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`,
    }
  }
  return RNFS.downloadFile({ fromUrl: url, toFile: path, ...options })
}

export const stopDownload = (jobId: number) => RNFS.stopDownload(jobId)
