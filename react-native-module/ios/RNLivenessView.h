#import <UIKit/UIKit.h>
#import <React/RCTComponent.h>

NS_ASSUME_NONNULL_BEGIN

@interface RNLivenessView : UIView

@property (nonatomic, copy, nullable) NSDictionary *config;
@property (nonatomic, copy, nullable) NSDictionary *sounds;
@property (nonatomic, copy, nullable) NSString *modelUrl;
@property (nonatomic, assign) BOOL started;

@property (nonatomic, copy, nullable) RCTDirectEventBlock onChallengeChanged;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onFaceInOval;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onLivenessPassed;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onLivenessFailure;

@end

NS_ASSUME_NONNULL_END
