#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <LivenessDetection/LivenessDetection-Swift.h>

NS_ASSUME_NONNULL_BEGIN

UIColor *_Nullable LivenessConfigColorFromHexString(id _Nullable v);
void LivenessConfigApply(LivenessConfig *config, NSDictionary *_Nullable opts);
LivenessSoundOptions *_Nullable LivenessConfigParseSounds(NSDictionary *_Nullable options);

NS_ASSUME_NONNULL_END
