#import "LivenessConfigParse.h"

UIColor *LivenessConfigColorFromHexString(id v) {
  if (![v isKindOfClass:[NSString class]]) return nil;
  NSString *trim = [(NSString *)v stringByReplacingOccurrencesOfString:@"#" withString:@""];
  unsigned int hex = 0;
  if (![[NSScanner scannerWithString:trim] scanHexInt:&hex]) return nil;
  CGFloat r, g, b, a;
  if (trim.length == 8) {            // AARRGGBB
    a = ((hex >> 24) & 0xFF) / 255.0;
    r = ((hex >> 16) & 0xFF) / 255.0;
    g = ((hex >> 8)  & 0xFF) / 255.0;
    b = (hex         & 0xFF) / 255.0;
  } else {                           // RRGGBB
    a = 1.0;
    r = ((hex >> 16) & 0xFF) / 255.0;
    g = ((hex >> 8)  & 0xFF) / 255.0;
    b = (hex         & 0xFF) / 255.0;
  }
  return [UIColor colorWithRed:r green:g blue:b alpha:a];
}

void LivenessConfigApply(LivenessConfig *config, NSDictionary *c) {
  if (![c isKindOfClass:[NSDictionary class]]) return;

  #define SET_FLOAT(key)  { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.floatValue; }
  #define SET_CGFLOAT(key){ NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = (CGFloat)v.doubleValue; }
  #define SET_INT64(key)  { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.longLongValue; }
  #define SET_INT(key)    { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.integerValue; }
  #define SET_BOOL(key)   { NSNumber *v = c[@#key]; if ([v isKindOfClass:[NSNumber class]]) config.key = v.boolValue; }
  #define SET_STRING(key) { NSString *v = c[@#key]; if ([v isKindOfClass:[NSString class]]) config.key = v; }
  #define SET_COLOR(key)  { UIColor *v = LivenessConfigColorFromHexString(c[@#key]); if (v) config.key = v; }

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

  // UI / theme
  SET_STRING(shape) SET_BOOL(showInstructions) SET_CGFLOAT(minSize)
  SET_CGFLOAT(progressWidth) SET_STRING(progressLineCap)
  SET_COLOR(progressColor) SET_COLOR(progressErrorColor)
  SET_COLOR(overlayColor)  SET_COLOR(overlayErrorColor)

  #undef SET_FLOAT
  #undef SET_CGFLOAT
  #undef SET_INT64
  #undef SET_INT
  #undef SET_BOOL
  #undef SET_STRING
  #undef SET_COLOR
}

LivenessSoundOptions *LivenessConfigParseSounds(NSDictionary *options) {
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
