#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LivenessDetectorPlugin, "LivenessDetector",
           CAP_PLUGIN_METHOD(startLiveness, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
)
