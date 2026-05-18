#import "RNLivenessView.h"
#import "LivenessConfigParse.h"
#import <LivenessDetection/LivenessDetection-Swift.h>

@interface RNLivenessView () <LivenessDetectorDelegate>
@property (nonatomic, strong) LivenessView *inner;
@end

@implementation RNLivenessView

- (instancetype)init {
  self = [super init];
  if (self) {
    _inner = [[LivenessView alloc] init];
    _inner.delegate = self;
    _inner.translatesAutoresizingMaskIntoConstraints = NO;
    [self addSubview:_inner];
    [NSLayoutConstraint activateConstraints:@[
      [_inner.topAnchor      constraintEqualToAnchor:self.topAnchor],
      [_inner.bottomAnchor   constraintEqualToAnchor:self.bottomAnchor],
      [_inner.leadingAnchor  constraintEqualToAnchor:self.leadingAnchor],
      [_inner.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
    ]];
  }
  return self;
}

- (void)willMoveToWindow:(UIWindow *)newWindow {
  [super willMoveToWindow:newWindow];
  if (newWindow == nil) {
    // Detaching — stop the camera and tear down the detector.
    [_inner stop];
  }
}

#pragma mark - Props

- (void)setConfig:(NSDictionary *)config {
  _config = [config copy];
  LivenessConfig *cfg = [[LivenessConfig alloc] init];
  LivenessConfigApply(cfg, _config);
  _inner.config = cfg;
}

- (void)setSounds:(NSDictionary *)sounds {
  _sounds = [sounds copy];
  if (![sounds isKindOfClass:[NSDictionary class]]) {
    _inner.sounds = nil;
    return;
  }
  // Wrap in a synthetic options dict so we can reuse LivenessConfigParseSounds (it accepts the outer shape).
  _inner.sounds = LivenessConfigParseSounds(@{ @"sounds": sounds });
}

- (void)setModelUrl:(NSString *)modelUrl {
  _modelUrl = [modelUrl copy];
  _inner.modelUrl = (modelUrl.length > 0) ? modelUrl : nil;
}

- (void)setStarted:(BOOL)started {
  if (_started == started) return;
  _started = started;
  if (started) {
    [_inner start];
  } else {
    [_inner stop];
  }
}

#pragma mark - LivenessDetectorDelegate

- (void)onChallengeChangedWithStepIndex:(NSInteger)stepIndex stepLabel:(NSString *)stepLabel {
  if (self.onChallengeChanged) {
    self.onChallengeChanged(@{ @"stepIndex": @(stepIndex), @"stepLabel": stepLabel ?: @"" });
  }
}

- (void)onFaceInOvalWithInside:(BOOL)inside reason:(NSString *)reason {
  if (!self.onFaceInOval) return;
  NSMutableDictionary *body = [@{ @"inside": @(inside) } mutableCopy];
  if (reason) body[@"reason"] = reason;
  self.onFaceInOval(body);
}

- (void)onLivenessPassedWithImageData:(NSData *)imageData {
  if (!self.onLivenessPassed) return;
  NSString *b64 = [imageData base64EncodedStringWithOptions:0];
  self.onLivenessPassed(@{ @"imageBase64": b64 ?: @"" });
}

- (void)onFailureWithReason:(NSString *)reason {
  if (self.onLivenessFailure) {
    self.onLivenessFailure(@{ @"reason": reason ?: @"" });
  }
}

- (void)onFaceDetectedWithBoundingBox:(NSValue *)boundingBox {
  // Not surfaced to JS — bridging optional CGRect to RN events isn't useful here.
}

@end
