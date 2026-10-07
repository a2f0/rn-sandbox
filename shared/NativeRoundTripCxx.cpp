#include "NativeRoundTripCxx.h"

#include "RoundTripCxxCore.h"

#include <thread>
#include <vector>

namespace facebook::react {

namespace {

// JSI's side of the copy rules in RoundTripCxxCore.h.
class JsiEngine {
 public:
  using Value = jsi::Value;

  explicit JsiEngine(jsi::Runtime &rt) : rt_(rt) {}

  roundtrip::Kind kind(const jsi::Value &value) {
    if (value.isUndefined()) {
      return roundtrip::Kind::Undefined;
    }
    if (value.isNull()) {
      return roundtrip::Kind::Null;
    }
    if (value.isBool()) {
      return roundtrip::Kind::Boolean;
    }
    if (value.isNumber()) {
      return roundtrip::Kind::Number;
    }
    if (value.isString()) {
      return roundtrip::Kind::String;
    }
    if (!value.isObject()) {
      return roundtrip::Kind::Other;
    }
    auto object = value.getObject(rt_);
    if (object.isArray(rt_)) {
      return roundtrip::Kind::Array;
    }
    if (object.isFunction(rt_) || object.isArrayBuffer(rt_)) {
      return roundtrip::Kind::Other;
    }
    return roundtrip::Kind::Object;
  }

  bool toBoolean(const jsi::Value &value) {
    return value.getBool();
  }

  double toNumber(const jsi::Value &value) {
    return value.getNumber();
  }

  std::string toString(const jsi::Value &value) {
    return value.getString(rt_).utf8(rt_);
  }

  std::vector<jsi::Value> elements(const jsi::Value &value) {
    auto array = value.getObject(rt_).getArray(rt_);
    std::vector<jsi::Value> elements;
    for (size_t i = 0, size = array.size(rt_); i < size; i++) {
      elements.push_back(array.getValueAtIndex(rt_, i));
    }
    return elements;
  }

  std::vector<std::pair<std::string, jsi::Value>> entries(const jsi::Value &value) {
    auto object = value.getObject(rt_);
    auto names = object.getPropertyNames(rt_);
    std::vector<std::pair<std::string, jsi::Value>> entries;
    for (size_t i = 0, size = names.size(rt_); i < size; i++) {
      auto name = names.getValueAtIndex(rt_, i).getString(rt_);
      entries.emplace_back(name.utf8(rt_), object.getProperty(rt_, jsi::PropNameID::forString(rt_, name)));
    }
    return entries;
  }

  bool same(const jsi::Value &a, const jsi::Value &b) {
    return jsi::Value::strictEquals(rt_, a, b);
  }

  jsi::Value copy(const jsi::Value &value) {
    return {rt_, value};
  }

  jsi::Value makeUndefined() {
    return jsi::Value::undefined();
  }

  jsi::Value makeNull() {
    return jsi::Value::null();
  }

  jsi::Value make(bool value) {
    return {value};
  }

  jsi::Value make(double value) {
    return {value};
  }

  jsi::Value make(const std::string &value) {
    return jsi::String::createFromUtf8(rt_, value);
  }

  jsi::Value makeArray(std::vector<jsi::Value> elements) {
    auto array = jsi::Array(rt_, elements.size());
    for (size_t i = 0; i < elements.size(); i++) {
      array.setValueAtIndex(rt_, i, std::move(elements[i]));
    }
    return array;
  }

  jsi::Value makeObject(std::vector<std::pair<std::string, jsi::Value>> entries) {
    auto object = jsi::Object(rt_);
    for (auto &[key, value] : entries) {
      // For a "__proto__" key, setProperty would run Object.prototype's
      // __proto__ setter instead of defining a property.
      if (key != "__proto__") {
        object.setProperty(rt_, jsi::PropNameID::forUtf8(rt_, key), std::move(value));
        continue;
      }
      auto descriptor = jsi::Object(rt_);
      descriptor.setProperty(rt_, "value", std::move(value));
      descriptor.setProperty(rt_, "writable", true);
      descriptor.setProperty(rt_, "enumerable", true);
      descriptor.setProperty(rt_, "configurable", true);
      rt_.global()
          .getPropertyAsObject(rt_, "Object")
          .getPropertyAsFunction(rt_, "defineProperty")
          .call(rt_, object, jsi::String::createFromUtf8(rt_, key), descriptor);
    }
    return object;
  }

 private:
  jsi::Runtime &rt_;
};

} // namespace

NativeRoundTripCxx::NativeRoundTripCxx(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeRoundTripCxxCxxSpec(std::move(jsInvoker)) {}

jsi::ArrayBuffer NativeRoundTripCxx::echoArrayBuffer(jsi::Runtime &rt, jsi::ArrayBuffer value) {
  auto copy = AsyncArrayBuffer::copy(rt, value);
  return rt.createArrayBuffer(copy.getMutableBuffer());
}

jsi::Value NativeRoundTripCxx::echoMixed(jsi::Runtime &rt, jsi::Value value) {
  JsiEngine engine(rt);
  std::vector<jsi::Value> ancestors;
  try {
    return roundtrip::fromMixed(engine, roundtrip::toMixed(engine, value, ancestors));
  } catch (const roundtrip::MixedError &error) {
    throw jsi::JSError(rt, error.what());
  }
}

// File I/O runs on a detached thread; the promise settles back on the JS
// thread through the CallInvoker. An exception escaping the thread would
// terminate the app, so every failure rejects instead.
AsyncPromise<int32_t> NativeRoundTripCxx::writeBytes(jsi::Runtime &rt, std::string path, jsi::ArrayBuffer value) {
  AsyncPromise<int32_t> promise(rt, jsInvoker_);
  auto bytes = AsyncArrayBuffer::copy(rt, value);
  std::thread([promise, path = std::move(path), bytes = std::move(bytes)]() mutable {
    try {
      if (auto error = roundtrip::writeFile(path, bytes.data(), bytes.size())) {
        promise.reject(Error(*error));
        return;
      }
      promise.resolve(static_cast<int32_t>(bytes.size()));
    } catch (const std::exception &e) {
      promise.reject(Error("Could not write " + path + ": " + e.what()));
    }
  }).detach();
  return promise;
}

AsyncPromise<AsyncArrayBuffer> NativeRoundTripCxx::readBytes(jsi::Runtime &rt, std::string path) {
  AsyncPromise<AsyncArrayBuffer> promise(rt, jsInvoker_);
  std::thread([promise, path = std::move(path)]() mutable {
    try {
      auto result = roundtrip::readFile(path);
      if (result.error) {
        promise.reject(Error(*result.error));
        return;
      }
      promise.resolve(AsyncArrayBuffer::wrap(std::move(result.bytes)));
    } catch (const std::exception &e) {
      promise.reject(Error("Could not read " + path + ": " + e.what()));
    }
  }).detach();
  return promise;
}

} // namespace facebook::react
