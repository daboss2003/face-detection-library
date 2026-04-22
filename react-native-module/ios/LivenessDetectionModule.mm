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

static LivenessSoundOptions *ParseSounds(NSDictionary *options) {
  NSDictionary *soundsDict = options[@"sounds"];
  if ([soundsDict isKindOfClass:[NSDictionary class]]) {
    return [[LivenessSoundOptions alloc]
      initWithBaseUrl:soundsDict[@"baseUrl"]
      left:soundsDict[@"left"]
      blink:soundsDict[@"blink"]
      right:soundsDict[@"right"]
      nod:soundsDict[@"nod"]
      mouth:soundsDict[@"mouth"]
      good:soundsDict[@"good"]
      capture:soundsDict[@"capture"]];
  }
  NSString *base = options[@"soundBaseUrl"];
  if ([base isKindOfClass:[NSString class]] && base.length > 0) {
    return [[LivenessSoundOptions alloc]
      initWithBaseUrl:base left:nil blink:nil right:nil nod:nil mouth:nil good:nil capture:nil];
  }
  return nil;
}

static LivenessConfig *ParseConfig(NSDictionary *options) {
  LivenessConfig *config = [[LivenessConfig alloc] init];
  NSDictionary *c = options[@"config"];
  if (![c isKindOfClass:[NSDictionary class]]) return config;

  #define SET_FLOAT(key) { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.floatValue; }
  #define SET_INT64(key) { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.longLongValue; }
  #define SET_INT(key)   { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.integerValue; }
  #define SET_BOOL(key)  { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.boolValue; }

  SET_INT64(readyMs) SET_INT64(sessionTimeoutMs) SET_INT(baselineFrames)
  SET_FLOAT(yawTurnDelta) SET_FLOAT(yawWrongDirDelta) SET_INT64(headTurnHoldMs)
  SET_FLOAT(nodDownDelta) SET_FLOAT(nodReturnFraction) SET_FLOAT(nodReturnMaxDelta)
  SET_FLOAT(blinkClosedThreshold) SET_FLOAT(blinkOpenThreshold)
  SET_FLOAT(earClosedThreshold) SET_FLOAT(earOpenThreshold)
  SET_INT64(blinkMaxDurationMs)
  SET_FLOAT(mouthOpenThreshold) SET_FLOAT(mouthOpenMarThreshold) SET_INT64(mouthHoldMs)
  SET_FLOAT(maxYawDuringBlink) SET_FLOAT(maxPitchDuringBlink)
  SET_FLOAT(maxYawDuringNod) SET_FLOAT(maxYawDuringMouth) SET_FLOAT(maxPitchDuringMouth)
  SET_FLOAT(ovalCx) SET_FLOAT(ovalCy) SET_FLOAT(ovalRx) SET_FLOAT(ovalRy)
  SET_FLOAT(minFaceSize) SET_FLOAT(maxFaceSize)
  SET_INT64(captureDelayMs) SET_INT(captureMaxAttempts)
  SET_FLOAT(captureMaxYaw) SET_FLOAT(captureMaxPitch)
  SET_FLOAT(captureMaxMouthScore) SET_FLOAT(captureMaxBlinkScore)
  SET_FLOAT(captureMinEar) SET_FLOAT(captureMaxMar)
  SET_BOOL(shuffleSteps)
  SET_INT(cdnMaxRetries) SET_INT64(cdnAttemptTimeoutMs) SET_INT64(connectivityCheckTimeoutMs)

  #undef SET_FLOAT
  #undef SET_INT64
  #undef SET_INT
  #undef SET_BOOL
  return config;
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
    LivenessSoundOptions *sounds = ParseSounds(options);
    LivenessConfig *config = ParseConfig(options);
    __weak __typeof__(self) wself = self;
    [LivenessDetector presentLivenessFrom:rootVC
                                 modelUrl:modelUrl
                                   sounds:sounds
                                   config:config
                       onChallengeChanged:^(NSInteger stepIndex, NSString *stepLabel) {
                                  [wself sendEventWithName:@"challengeChanged"
                                                      body:@{ @"stepIndex": @(stepIndex), @"stepLabel": stepLabel ?: @"" }];
                                }
                             onFaceInOval:^(BOOL inside, NSString *reason) {
                                  NSMutableDictionary *body = [@{ @"inside": @(inside) } mutableCopy];
                                  if (reason) body[@"reason"] = reason;
                                  [wself sendEventWithName:@"faceInOval" body:body];
                                }
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
