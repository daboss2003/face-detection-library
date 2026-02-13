#import "LivenessDetectionModule.h"
#import <React/RCTUtils.h>
#import <LivenessDetection/LivenessDetection-Swift.h>

@interface LivenessDetectionModule () <LivenessDetectorDelegate>
@property(nonatomic, strong) LivenessDetector *detector;
@property(nonatomic, strong) UIView *overlayView;
@property(nonatomic, copy) RCTPromiseResolveBlock pendingResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock pendingReject;
@end

@implementation LivenessDetectionModule

RCT_EXPORT_MODULE(LivenessDetection)

- (NSArray<NSString *> *)supportedEvents {
  return @[@"challengeChanged", @"failure"];
}

- (void)startLiveness:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    self.pendingResolve = resolve;
    self.pendingReject = reject;
    [self stopInternal];

    UIViewController *rootVC = RCTPresentedViewController();
    if (!rootVC) {
      reject(@"NO_VIEW", @"Unable to access root view", nil);
      return;
    }
    UIView *rootView = rootVC.view;
    UIView *preview = [[UIView alloc] initWithFrame:rootView.bounds];
    preview.backgroundColor = [UIColor clearColor];
    [rootView addSubview:preview];
    self.overlayView = preview;

    self.detector = [[LivenessDetector alloc] initWithDelegate:self];
    [self.detector startLivenessWithPreviewView:preview useFrontCamera:YES];
  });
}

- (void)stop {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self stopInternal];
  });
}

- (void)stopInternal {
  [self.detector stop];
  self.detector = nil;
  [self.overlayView removeFromSuperview];
  self.overlayView = nil;
  self.pendingResolve = nil;
  self.pendingReject = nil;
}

#pragma mark - LivenessDetectorDelegate

- (void)onChallengeChangedWithStepIndex:(NSInteger)stepIndex stepLabel:(NSString *)stepLabel {
  [self sendEventWithName:@"challengeChanged" body:@{
    @"stepIndex": @(stepIndex),
    @"stepLabel": stepLabel ?: @""
  }];
}

- (void)onLivenessPassedWithImageData:(NSData *)imageData {
  if (self.pendingResolve) {
    NSString *base64 = [imageData base64EncodedStringWithOptions:0];
    self.pendingResolve(@{ @"imageBase64": base64 ?: @"" });
  }
  [self stopInternal];
}

- (void)onFailureWithReason:(NSString *)reason {
  [self sendEventWithName:@"failure" body:@{ @"reason": reason ?: @"" }];
  if (self.pendingReject) {
    self.pendingReject(@"LIVENESS_FAILED", reason ?: @"Liveness failed", nil);
  }
  [self stopInternal];
}

- (void)onFaceDetectedWithBoundingBox:(CGRect)boundingBox {
  // Optional; no-op for RN.
}

@end
