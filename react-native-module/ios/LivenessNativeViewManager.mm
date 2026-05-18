#import <React/RCTViewManager.h>
#import "RNLivenessView.h"

@interface LivenessNativeViewManager : RCTViewManager
@end

@implementation LivenessNativeViewManager

RCT_EXPORT_MODULE(LivenessNativeView)

- (UIView *)view {
  return [[RNLivenessView alloc] init];
}

+ (BOOL)requiresMainQueueSetup { return YES; }

RCT_EXPORT_VIEW_PROPERTY(config,             NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(sounds,             NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(modelUrl,           NSString)
RCT_EXPORT_VIEW_PROPERTY(started,            BOOL)
RCT_EXPORT_VIEW_PROPERTY(onChallengeChanged, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onFaceInOval,       RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onLivenessPassed,   RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onLivenessFailure,  RCTDirectEventBlock)

@end
