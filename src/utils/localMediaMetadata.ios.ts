import { NativeModules } from 'react-native'
import { temporaryDirectoryPath, readDir, unlink, extname } from '@/utils/fs'

const Native = (NativeModules as any).IOSMediaMetadata

export interface MusicMetadata {
  albumName: string
  singer: string
  name: string
}
export interface MusicMetadataFull {
  type: 'mp3' | 'flac' | 'ogg' | 'wav'
  bitrate: string
  interval: number
  size: number
  ext: 'mp3' | 'flac' | 'ogg' | 'wav'
  albumName: string
  singer: string
  name: string
}

export const readMetadata = async(filePath: string): Promise<MusicMetadataFull | null> => {
  if (!Native) return null
  return Native.readMetadata(filePath)
}

// iOS 无法原地写回音频标签，保持接口兼容（no-op）
export const writeMetadata = async(_filePath: string, _metadata: MusicMetadata, _isOverwrite?: boolean): Promise<void> => {
  return
}

export const writePic = async(_filePath: string, _picPath: string): Promise<void> => {
  return
}

let cleared = false
const picCachePath = temporaryDirectoryPath + '/local-media-metadata'

export const scanAudioFiles = async(dirPath: string) => {
  const files = await readDir(dirPath)
  return files.filter(file => {
    if (file.mimeType?.startsWith('audio/')) return true
    if (extname(file?.name ?? '') === 'ogg') return true
    return false
  })
}

const clearPicCache = async() => {
  await unlink(picCachePath)
  cleared = true
}

export const readPic = async(dirPath: string): Promise<string> => {
  if (!Native) return ''
  if (!cleared) await clearPicCache()
  return Native.readPic(dirPath, picCachePath)
}

export const readLyric = async(filePath: string, isReadLrcFile?: boolean): Promise<string> => {
  if (!Native) return ''
  return Native.readLyric(filePath, isReadLrcFile ?? true)
}

export const writeLyric = async(filePath: string, lyric: string): Promise<void> => {
  if (!Native) return
  return Native.writeLyric(filePath, lyric)
}
