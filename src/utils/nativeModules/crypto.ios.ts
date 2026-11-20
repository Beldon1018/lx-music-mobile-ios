import CryptoJS from 'crypto-js'
// jsrsasign 无可靠类型声明，用 require 引入
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { KJUR, b64tohex, hextob64 } = require('jsrsasign') as {
  KJUR: any
  b64tohex: (s: string) => string
  hextob64: (s: string) => string
}

/**
 * iOS 加密模块（JS 实现）
 * 对应 Android 版 src/utils/nativeModules/crypto.ts（Java JCA）
 * 保持完全相同的导出 API，上层音源 SDK / 同步服务零改动。
 *
 * 注意：Android 版 AES_MODE.ECB_128_NoPadding 的值是 'AES'，
 * 即 Java 的 AES/ECB/PKCS5Padding（16 字节块下等价于 PKCS7），不是真正的 NoPadding。
 */

enum KEY_PREFIX {
  publicKeyStart = '-----BEGIN PUBLIC KEY-----',
  publicKeyEnd = '-----END PUBLIC KEY-----',
  privateKeyStart = '-----BEGIN PRIVATE KEY-----',
  privateKeyEnd = '-----END PRIVATE KEY-----',
}

export enum RSA_PADDING {
  OAEPWithSHA1AndMGF1Padding = 'RSA/ECB/OAEPWithSHA1AndMGF1Padding',
  NoPadding = 'RSA/ECB/NoPadding',
}

export enum AES_MODE {
  CBC_128_PKCS7Padding = 'AES/CBC/PKCS7Padding',
  ECB_128_NoPadding = 'AES',
}

const Utf8 = CryptoJS.enc.Utf8
const Base64 = CryptoJS.enc.Base64
const Hex = CryptoJS.enc.Hex

// Java: Base64 编码的 key/iv 字节 -> WordArray
const keyFromBase64 = (b64: string) => Base64.parse(b64)
// iv: Java 传入的 vi 通常是 base64 字符串，空则用全 0
const ivFrom = (vi: string) => vi ? Base64.parse(vi) : CryptoJS.lib.WordArray.create(new Array(16).fill(0), 16)

const aesEncryptInternal = (text: string, key: string, vi: string, mode: AES_MODE, output: 'base64' | 'hex'): string => {
  const isCBC = mode === AES_MODE.CBC_128_PKCS7Padding
  // Android: data/key/iv 均为 base64 解码后的字节
  const plaintext = Base64.parse(text)
  const keyWA = keyFromBase64(key)
  const cfg: any = {
    mode: isCBC ? CryptoJS.mode.CBC : CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7, // Java "AES" == AES/ECB/PKCS5Padding == PKCS7(16B)
  }
  if (isCBC) cfg.iv = ivFrom(vi)
  const encrypted = CryptoJS.AES.encrypt(plaintext, keyWA, cfg)
  const cipherWA = encrypted.ciphertext
  return output === 'hex' ? cipherWA.toString(Hex) : cipherWA.toString(Base64)
}

const aesDecryptInternal = (text: string, key: string, vi: string, mode: AES_MODE): string => {
  const isCBC = mode === AES_MODE.CBC_128_PKCS7Padding
  const keyWA = keyFromBase64(key)
  const cfg: any = {
    mode: isCBC ? CryptoJS.mode.CBC : CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }
  if (isCBC) cfg.iv = ivFrom(vi)
  const decrypted = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: Base64.parse(text) }),
    keyWA,
    cfg,
  )
  // Android: new String(decryptedBytes, UTF_8)
  return decrypted.toString(Utf8)
}

export const aesEncrypt = async(text: string, key: string, vi: string, mode: AES_MODE): Promise<string> =>
  aesEncryptInternal(text, key, vi, mode, 'base64')
export const aesDecrypt = async(text: string, key: string, vi: string, mode: AES_MODE): Promise<string> =>
  aesDecryptInternal(text, key, vi, mode)
export const aesEncryptSync = (text: string, key: string, vi: string, mode: AES_MODE): string =>
  aesEncryptInternal(text, key, vi, mode, 'base64')
export const aesDecryptSync = (text: string, key: string, vi: string, mode: AES_MODE): string =>
  aesDecryptInternal(text, key, vi, mode)

// ---- RSA（jsrsasign）----

const normalizePublicKey = (key: string) => key
  .replace(KEY_PREFIX.publicKeyStart, '').replace(KEY_PREFIX.publicKeyEnd, '')
  .replace(/\s/g, '')
const normalizePrivateKey = (key: string) => key
  .replace(KEY_PREFIX.privateKeyStart, '').replace(KEY_PREFIX.privateKeyEnd, '')
  .replace(/\s/g, '')

export const generateRsaKey = async(): Promise<{ publicKey: string, privateKey: string }> => {
  const kp = KJUR.crypto.Util.generateKeypair(1024, 'RSA')
  return {
    publicKey: `${KEY_PREFIX.publicKeyStart}\n${KJUR.crypto.Util.getPEMFromKeyPair(kp, 'public')}${KEY_PREFIX.publicKeyEnd}`,
    privateKey: `${KEY_PREFIX.privateKeyStart}\n${KJUR.crypto.Util.getPEMFromKeyPair(kp, 'private')}${KEY_PREFIX.privateKeyEnd}`,
  }
}

const rsaEncryptInternal = (text: string, key: string, padding: RSA_PADDING): string => {
  const pub = new KJUR.crypto.Cipher({ alg: padding === RSA_PADDING.NoPadding ? 'RSA' : 'RSAOAEP', prov: 'cryptojs/jsrsa' })
  pub.initEncryptByKey(normalizePublicKey(key))
  // text 为 base64 字符串；Java 端对 base64 字节做 RSA，转 hex 再加密
  const hex = b64tohex(text)
  return hextob64(pub.encryptHex(hex))
}

const rsaDecryptInternal = (text: string, key: string, padding: RSA_PADDING): string => {
  const prv = new KJUR.crypto.Cipher({ alg: padding === RSA_PADDING.NoPadding ? 'RSA' : 'RSAOAEP', prov: 'cryptojs/jsrsa' })
  prv.initDecryptByKey(normalizePrivateKey(key))
  const hex = prv.decryptHex(b64tohex(text))
  return hextob64(hex)
}

export const rsaEncrypt = async(text: string, key: string, padding: RSA_PADDING): Promise<string> =>
  rsaEncryptInternal(text, key, padding)
export const rsaDecrypt = async(text: string, key: string, padding: RSA_PADDING): Promise<string> =>
  rsaDecryptInternal(text, key, padding)
export const rsaEncryptSync = (text: string, key: string, padding: RSA_PADDING): string =>
  rsaEncryptInternal(text, key, padding)
export const rsaDecryptSync = (text: string, key: string, padding: RSA_PADDING): string =>
  rsaDecryptInternal(text, key, padding)

export const hashSHA1 = async(text: any): Promise<string> =>
  CryptoJS.SHA1(typeof text === 'string' ? text : text.toString()).toString(CryptoJS.enc.Hex)
