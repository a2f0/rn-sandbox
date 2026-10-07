#pragma once

#include <AppSpecsJSI.h>

#include <react/bridging/ArrayBuffer.h>
#include <react/bridging/Promise.h>

#include <memory>
#include <string>

namespace facebook::react {

// The C++-only TurboModule types: ArrayBuffer and mixed. Built into the iOS
// app (registered by NativeRoundTripCxxProvider) and the Android app
// (registered in android/app/src/main/jni/OnLoad.cpp).
class NativeRoundTripCxx : public NativeRoundTripCxxCxxSpec<NativeRoundTripCxx> {
 public:
  explicit NativeRoundTripCxx(std::shared_ptr<CallInvoker> jsInvoker);

  jsi::ArrayBuffer echoArrayBuffer(jsi::Runtime &rt, jsi::ArrayBuffer value);

  jsi::Value echoMixed(jsi::Runtime &rt, jsi::Value value);

  AsyncPromise<int32_t> writeBytes(jsi::Runtime &rt, std::string path, jsi::ArrayBuffer value);

  AsyncPromise<AsyncArrayBuffer> readBytes(jsi::Runtime &rt, std::string path);
};

} // namespace facebook::react
