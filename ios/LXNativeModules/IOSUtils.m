#import "IOSUtils.h"
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <SystemConfiguration/SystemConfiguration.h>
#import <net/if.h>
#import <ifaddrs.h>
#import <arpa/inet.h>

@implementation IOSUtils

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return YES; }

RCT_EXPORT_METHOD(exitApp) {
  // iOS 不允许主动退出应用，移到后台
  dispatch_async(dispatch_get_main_queue(), ^{
    UIApplication *app = UIApplication.sharedApplication;
    [app performSelector:@selector(suspend)];
  });
}

RCT_EXPORT_METHOD(getDeviceName:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(UIDevice.currentDevice.name ?: @"Unknown");
}

RCT_EXPORT_METHOD(getSystemLocales:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSArray<NSString *> *langs = NSLocale.preferredLanguages;
  resolve(langs.firstObject ?: @"en");
}

RCT_EXPORT_METHOD(getWIFIIPV4Address:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *address = @"0.0.0.0";
  struct ifaddrs *interfaces = NULL;
  if (getifaddrs(&interfaces) == 0) {
    struct ifaddrs *temp = interfaces;
    while (temp != NULL) {
      if (temp->ifa_addr->sa_family == AF_INET) {
        NSString *iface = [NSString stringWithUTF8String:temp->ifa_name];
        if ([iface isEqualToString:@"en0"]) {
          address = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp->ifa_addr)->sin_addr)];
          break;
        }
      }
      temp = temp->ifa_next;
    }
  }
  freeifaddrs(interfaces);
  resolve(address);
}

RCT_EXPORT_METHOD(shareText:(NSString *)shareTitle title:(NSString *)title text:(NSString *)text resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *root = UIApplication.sharedApplication.keyWindow.rootViewController;
    while (root.presentedViewController) root = root.presentedViewController;
    NSArray *items = @[text.length ? text : (title ?: @""), [NSURL URLWithString:@"https://github.com/lyswhut/lx-music-mobile"]];
    UIActivityViewController *vc = [[UIActivityViewController alloc] initWithActivityItems:items applicationActivities:nil];
    if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
      vc.popoverPresentationController.sourceView = root.view;
    }
    [root presentViewController:vc animated:YES completion:nil];
    resolve(@YES);
  });
}

RCT_EXPORT_METHOD(isNotificationsEnabled:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  __weak typeof(self) weakSelf = self;
  [[UNUserNotificationCenter currentNotificationCenter] getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
    __strong typeof(weakSelf) self = weakSelf;
    resolve(@(settings.authorizationStatus == UNAuthorizationStatusAuthorized || settings.authorizationStatus == UNAuthorizationStatusProvisional));
  }];
}

RCT_EXPORT_METHOD(openNotificationPermissionActivity:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
    completionHandler:^(BOOL granted, NSError * _Nullable error) {
      resolve(@(granted));
    }];
}

RCT_EXPORT_METHOD(screenkeepAwake) {
  [UIApplication sharedApplication].idleTimerDisabled = YES;
}

RCT_EXPORT_METHOD(screenUnkeepAwake) {
  [UIApplication sharedApplication].idleTimerDisabled = NO;
}

RCT_EXPORT_METHOD(getWindowSize:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    CGSize size = UIApplication.sharedApplication.keyWindow.bounds.size;
    resolve(@{ @"width": @(size.width), @"height": @(size.height) });
  });
}

@end
