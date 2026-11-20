#import "IOSDocumentPicker.h"
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@class PickerDelegate;

@implementation IOSDocumentPicker

RCT_EXPORT_MODULE()

static NSString *const kBookmarksKey = @"lx_ios_document_bookmarks";

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

#pragma mark - Bookmark 持久化

- (NSMutableDictionary<NSString *, NSData *> *)loadBookmarks {
  NSDictionary *saved = [[NSUserDefaults standardUserDefaults] dictionaryForKey:kBookmarksKey];
  return saved ? [saved mutableCopy] : [NSMutableDictionary dictionary];
}

- (void)saveBookmarks:(NSDictionary<NSString *, NSData *> *)bookmarks {
  [[NSUserDefaults standardUserDefaults] setObject:bookmarks forKey:kBookmarksKey];
}

// 将安全作用域 URL 解析为可用路径，并持久化 bookmark
- (NSString *)resolveAndPersistURL:(NSURL *)url persist:(BOOL)persist {
  [url startAccessingSecurityScopedResource];
  NSString *path = url.path;
  if (persist) {
    NSError *error = nil;
    NSData *bookmark = [url bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
                     includingResourceValuesForKeys:nil
                                      relativeToURL:nil
                                              error:&error];
    if (bookmark && !error) {
      NSMutableDictionary *bookmarks = [self loadBookmarks];
      [bookmarks setObject:bookmark forKey:path];
      [self saveBookmarks:bookmarks];
    }
  }
  return path;
}

#pragma mark - 选择目录

RCT_EXPORT_METHOD(openDocumentTree:(BOOL)persist
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  UIViewController *root = [self topViewController];
  if (!root) {
    reject(@"NO_ROOT", @"无法获取根视图控制器", nil);
    return;
  }

  UIDocumentPickerViewController *picker;
  if (@available(iOS 16.0, *)) {
    UIDocumentPickerConfiguration *config = [[UIDocumentPickerConfiguration alloc]
      initWithAllowedContentTypes:@[UTTypeFolder]
      allowsMultipleSelection:NO
      updatable:NO];
    picker = [[UIDocumentPickerViewController alloc] initWithConfiguration:config];
  } else {
    picker = [[UIDocumentPickerViewController alloc]
      initWithDocumentTypes:@[@"public.folder"]
      inMode:UIDocumentPickerModeOpen];
  }

  // 使用代理对象（block 形式的初始化在 iOS 16 deprecated，这里用 setter 保兼容）
  picker.delegate = (id<UIDocumentPickerDelegate>)[self pickerDelegateWithHandler:^(NSArray<NSURL *> *urls) {
    if (urls.count == 0) { resolve(nil); return; }
    resolve([self resolveAndPersistURL:urls.firstObject persist:persist]);
  }];

  [root presentViewController:picker animated:YES completion:nil];
}

#pragma mark - 选择文件

RCT_EXPORT_METHOD(openDocument:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  UIViewController *root = [self topViewController];
  if (!root) {
    reject(@"NO_ROOT", @"无法获取根视图控制器", nil);
    return;
  }

  NSArray<NSString *> *mimeTypes = options[@"mimeTypes"] ?: @[];
  NSArray<NSString *> *extTypes = options[@"extTypes"] ?: @[];
  BOOL multi = [options[@"multi"] boolValue];
  NSString *toPath = options[@"toPath"];

  NSMutableArray<UTType *> *types = [NSMutableArray array];
  for (NSString *mime in mimeTypes) {
    UTType *type = [UTType typeWithMIMEType:mime];
    if (type) [types addObject:type];
  }
  for (NSString *ext in extTypes) {
    UTType *type = [UTType typeWithFilenameExtension:ext];
    if (type) [types addObject:type];
  }
  if (types.count == 0) [types addObject:UTTypeData];

  UIDocumentPickerViewController *picker;
  if (@available(iOS 16.0, *)) {
    UIDocumentPickerConfiguration *config = [[UIDocumentPickerConfiguration alloc]
      initWithAllowedContentTypes:types
      allowsMultipleSelection:multi
      updatable:NO];
    picker = [[UIDocumentPickerViewController alloc] initWithConfiguration:config];
  } else {
    picker = [[UIDocumentPickerViewController alloc]
      initWithDocumentTypes:[types valueForKey:@"identifier"]
      inMode:UIDocumentPickerModeImport];
  }

  picker.delegate = (id<UIDocumentPickerDelegate>)[self pickerDelegateWithHandler:^(NSArray<NSURL *> *urls) {
    if (urls.count == 0) { resolve(nil); return; }
    NSURL *url = urls.firstObject;
    [url startAccessingSecurityScopedResource];

    NSString *resultPath;
    if (toPath.length > 0) {
      NSURL *dest = [NSURL fileURLWithPath:toPath];
      NSError *copyError = nil;
      [[NSFileManager defaultManager] copyItemAtURL:url toURL:dest error:&copyError];
      resultPath = copyError ? url.path : dest.path;
    } else {
      // 复制到沙盒文档目录，避免安全作用域失效
      NSString *docs = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
      NSString *fileName = url.lastPathComponent;
      NSString *destPath = [docs stringByAppendingPathComponent:fileName];
      NSURL *dest = [NSURL fileURLWithPath:destPath];
      NSError *copyError = nil;
      [[NSFileManager defaultManager] copyItemAtURL:url toURL:dest error:&copyError];
      resultPath = copyError ? url.path : destPath;
    }
    [url stopAccessingSecurityScopedResource];
    resolve(resultPath);
  }];

  [root presentViewController:picker animated:YES completion:nil];
}

#pragma mark - Bookmark 管理

RCT_EXPORT_METHOD(getBookmarks:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  // 解析所有 bookmark，恢复访问权限，返回路径列表
  NSDictionary<NSString *, NSData *> *bookmarks = [self loadBookmarks];
  NSMutableArray<NSString *> *paths = [NSMutableArray array];
  for (NSString *path in bookmarks.allKeys) {
    NSData *data = bookmarks[path];
    BOOL stale = NO;
    NSURL *url = [NSURL URLByResolvingBookmarkData:data
                                           options:NSURLBookmarkResolutionWithSecurityScope
                                     relativeToURL:nil
                               bookmarkDataIsStale:&stale
                                             error:nil];
    if (url) {
      [url startAccessingSecurityScopedResource];
      [paths addObject:url.path];
    }
  }
  resolve(paths);
}

RCT_EXPORT_METHOD(removeBookmark:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSMutableDictionary *bookmarks = [self loadBookmarks];
  [bookmarks removeObjectForKey:path];
  [self saveBookmarks:bookmarks];
  resolve(@YES);
}

#pragma mark - 工具

- (UIViewController *)topViewController {
  UIWindow *window = UIApplication.sharedApplication.keyWindow;
  UIViewController *vc = window.rootViewController;
  while (vc.presentedViewController) vc = vc.presentedViewController;
  return vc;
}

// 轻量代理对象，把 didPickDocuments 回调转成 block
- (id<UIDocumentPickerDelegate>)pickerDelegateWithHandler:(void (^)(NSArray<NSURL *> *))handler {
  return [[PickerDelegate alloc] initWithHandler:handler];
}

@end

@interface PickerDelegate : NSObject <UIDocumentPickerDelegate>
@property (nonatomic, copy) void (^handler)(NSArray<NSURL *> *);
- (instancetype)initWithHandler:(void (^)(NSArray<NSURL *> *))handler;
@end

@implementation PickerDelegate
- (instancetype)initWithHandler:(void (^)(NSArray<NSURL *> *))handler {
  if (self = [super init]) { _handler = handler; }
  return self;
}
- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
  self.handler(urls);
}
- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
  self.handler(@[]);
}
@end
