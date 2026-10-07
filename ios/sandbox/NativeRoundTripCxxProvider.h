#import <Foundation/Foundation.h>
#import <ReactCommon/RCTTurboModule.h>

NS_ASSUME_NONNULL_BEGIN

// Provides the shared C++ TurboModule (shared/NativeRoundTripCxx.cpp),
// registered as NativeRoundTripCxx through codegenConfig.ios.modulesProvider in
// package.json.
@interface NativeRoundTripCxxProvider : NSObject <RCTModuleProvider>
@end

NS_ASSUME_NONNULL_END
