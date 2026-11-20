// iOS 平台依赖裁剪
// 以下 fork 依赖是纯 Android 实现（iOS 目录为空），在 iOS 上禁用自动链接，
// 对应的 JS 层由 .ios.ts 平台文件替代实现。
module.exports = {
  dependencies: {
    'react-native-file-system': {
      platforms: {
        // iOS 禁用自动链接（iOS 原生目录为空）；Android 保持原样
        ios: null,
      },
    },
    'react-native-local-media-metadata': {
      platforms: {
        // iOS 禁用自动链接（iOS 原生目录为空）；Android 保持原样
        ios: null,
      },
    },
  },
}
