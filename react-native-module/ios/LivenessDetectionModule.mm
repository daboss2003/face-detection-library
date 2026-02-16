#import "LivenessDetectionModule.h"
#import <React/RCTUtils.h>
#import <LivenessDetection/LivenessDetection-Swift.h>

@interface LivenessDetectionModule ()
@end

@implementation LivenessDetectionModule

RCT_EXPORT_MODULE(LivenessDetection)

- (NSArray<NSString *> *)supportedEvents {
  return @[@"challengeChanged", @"failure", @"faceInOval"];
}

- (void)startLiveness:(NSDictionary *)options resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *rootVC = RCTPresentedViewController();
    if (!rootVC) {
      reject(@"NO_VIEW", @"Unable to access root view", nil);
      return;
    }
    NSString *modelUrl = options[@"modelUrl"];
    if (modelUrl != nil && modelUrl.length == 0) modelUrl = nil;
    NSString *soundBaseUrl = options[@"soundBaseUrl"];
    if (soundBaseUrl != nil && soundBaseUrl.length == 0) soundBaseUrl = nil;
    __weak __typeof__(self) wself = self;
    [LivenessDetector presentLivenessFrom:rootVC
                                 modelUrl:modelUrl
                             soundBaseUrl:soundBaseUrl
                                onSuccess:^(NSData *imageData) {
                                  NSString *base64 = [imageData base64EncodedStringWithOptions:0];
                                  resolve(@{ @"imageBase64": base64 ?: @"" });
                                }
                                onFailure:^(NSString *reason) {
                                  [wself sendEventWithName:@"failure" body:@{ @"reason": reason ?: @"" }];
                                  reject(@"LIVENESS_FAILED", reason ?: @"Liveness failed", nil);
                                }];
  });
}

- (void)stop {
  // No-op when using SDK-owned UI; stop is not applicable.
}

@end
