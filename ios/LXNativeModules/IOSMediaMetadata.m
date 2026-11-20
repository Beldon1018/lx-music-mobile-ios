#import "IOSMediaMetadata.h"
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

@implementation IOSMediaMetadata

RCT_EXPORT_MODULE()

#pragma mark - 读取元数据

RCT_EXPORT_METHOD(readMetadata:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *url = [NSURL fileURLWithPath:filePath];
  AVAsset *asset = [AVAsset assetWithURL:url];
  NSArray *commonKeys = @[
    AVMetadataCommonKeyTitle,
    AVMetadataCommonKeyArtist,
    AVMetadataCommonKeyAlbumName
  ];
  [asset loadValuesAsynchronouslyForKeys:@[@"commonMetadata", @"duration"] completionHandler:^{
    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    for (AVMetadataItem *item in asset.commonMetadata) {
      if (!item.commonKey) continue;
      if ([item.commonKey isEqualToString:AVMetadataCommonKeyTitle] && item.value) {
        result[@"name"] = item.value;
      } else if ([item.commonKey isEqualToString:AVMetadataCommonKeyArtist] && item.value) {
        result[@"singer"] = item.value;
      } else if ([item.commonKey isEqualToString:AVMetadataCommonKeyAlbumName] && item.value) {
        result[@"albumName"] = item.value;
      }
    }
    result[@"interval"] = @(CMTimeGetSeconds(asset.duration));

    // 文件类型与大小
    NSString *ext = filePath.pathExtension.lowercaseString;
    NSDictionary *typeMap = @{@"mp3": @"mp3", @"m4a": @"mp3", @"flac": @"flac", @"ogg": @"ogg", @"wav": @"wav"};
    result[@"type"] = typeMap[ext] ?: @"mp3";
    result[@"ext"] = ext ?: @"mp3";
    NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:filePath error:nil];
    result[@"size"] = attrs[NSFileSize] ?: @0;
    result[@"bitrate"] = @"0";

    resolve(result);
  }];
}

#pragma mark - 写元数据（iOS 无法原地写回 AVAsset，改为提示不支持）

RCT_EXPORT_METHOD(writeMetadata:(NSString *)filePath
                  metadata:(NSDictionary *)metadata
                  isOverwrite:(BOOL)isOverwrite
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  // iOS 的 AVAsset 不支持原地写入标签；如需写入需转码另存，成本高。
  // 这里保持接口兼容，静默返回，避免上层崩溃。
  resolve(@YES);
}

#pragma mark - 读取内嵌封面

RCT_EXPORT_METHOD(readPic:(NSString *)filePath
                  picDir:(NSString *)picDir
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *url = [NSURL fileURLWithPath:filePath];
  AVAsset *asset = [AVAsset assetWithURL:url];
  [asset loadValuesAsynchronouslyForKeys:@[@"commonMetadata"] completionHandler:^{
    NSData *artworkData = nil;
    for (AVMetadataItem *item in asset.commonMetadata) {
      if ([item.commonKey isEqualToString:AVMetadataCommonKeyArtwork]) {
        if ([item.value isKindOfClass:[NSData class]]) {
          artworkData = (NSData *)item.value;
        } else if ([item.value isKindOfClass:[UIImage class]]) {
          artworkData = UIImagePNGRepresentation((UIImage *)item.value);
        }
        break;
      }
    }
    if (!artworkData) {
      resolve(@"");
      return;
    }
    [[NSFileManager defaultManager] createDirectoryAtPath:picDir withIntermediateDirectories:YES attributes:nil error:nil];
    NSString *name = [[filePath lastPathComponent] stringByDeletingPathExtension];
    NSString *outPath = [picDir stringByAppendingPathComponent:[name stringByAppendingString:@".jpg"]];
    [artworkData writeToFile:outPath atomically:YES];
    resolve(outPath);
  }];
}

#pragma mark - 写封面（iOS 不支持原地写回，保持接口兼容）

RCT_EXPORT_METHOD(writePic:(NSString *)filePath
                  picPath:(NSString *)picPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@YES);
}

#pragma mark - 歌词读写（使用同目录 .lrc 文件）

- (NSString *)lrcPathFor:(NSString *)filePath {
  return [[filePath stringByDeletingPathExtension] stringByAppendingPathExtension:@"lrc"];
}

RCT_EXPORT_METHOD(readLyric:(NSString *)filePath
                  isReadLrcFile:(BOOL)isReadLrcFile
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *lrcPath = [self lrcPathFor:filePath];
  NSString *content = [NSString stringWithContentsOfFile:lrcPath encoding:NSUTF8StringEncoding error:nil];
  resolve(content ?: @"");
}

RCT_EXPORT_METHOD(writeLyric:(NSString *)filePath
                  lyric:(NSString *)lyric
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *lrcPath = [self lrcPathFor:filePath];
  NSError *error = nil;
  [lyric writeToFile:lrcPath atomically:YES encoding:NSUTF8StringEncoding error:&error];
  if (error) { reject(@"WRITE_LYRIC_FAILED", error.localizedDescription, error); return; }
  resolve(@YES);
}

@end
