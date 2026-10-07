#include "NativeRoundTripCxx.h"

#include <fstream>
#include <thread>
#include <vector>

namespace facebook::react {

namespace {

// A JSON-like value held entirely in C++, so echoMixed returns a deep copy
// rather than the JS value it was given.
struct Mixed {
  enum class Kind { Undefined, Null, Boolean, Number, String, Array, Object };

  Kind kind = Kind::Undefined;
  bool boolean = false;
  double number = 0;
  std::string string;
  // Array elements, or object values in the order of keys.
  std::vector<Mixed> items;
  std::vector<std::string> keys;
};

// Nesting deeper than this throws instead of overflowing the native stack.
constexpr size_t kMaxDepth = 256;

// ancestors holds the objects enclosing value, to reject cycles.
Mixed toMixed(jsi::Runtime &rt, const jsi::Value &value, std::vector<jsi::Object> &ancestors) {
  Mixed result;
  if (value.isUndefined()) {
    result.kind = Mixed::Kind::Undefined;
  } else if (value.isNull()) {
    result.kind = Mixed::Kind::Null;
  } else if (value.isBool()) {
    result.kind = Mixed::Kind::Boolean;
    result.boolean = value.getBool();
  } else if (value.isNumber()) {
    result.kind = Mixed::Kind::Number;
    result.number = value.getNumber();
  } else if (value.isString()) {
    result.kind = Mixed::Kind::String;
    result.string = value.getString(rt).utf8(rt);
  } else if (value.isObject()) {
    auto object = value.getObject(rt);
    if (object.isFunction(rt) || object.isArrayBuffer(rt)) {
      throw jsi::JSError(rt, "echoMixed accepts only JSON-like values");
    }
    for (const auto &ancestor : ancestors) {
      if (jsi::Object::strictEquals(rt, ancestor, object)) {
        throw jsi::JSError(rt, "echoMixed can't copy a cyclic value");
      }
    }
    if (ancestors.size() == kMaxDepth) {
      throw jsi::JSError(rt, "echoMixed accepts values nested at most " + std::to_string(kMaxDepth) + " deep");
    }
    ancestors.push_back(value.getObject(rt));
    if (object.isArray(rt)) {
      auto array = object.getArray(rt);
      result.kind = Mixed::Kind::Array;
      for (size_t i = 0, size = array.size(rt); i < size; i++) {
        result.items.push_back(toMixed(rt, array.getValueAtIndex(rt, i), ancestors));
      }
    } else {
      auto names = object.getPropertyNames(rt);
      result.kind = Mixed::Kind::Object;
      for (size_t i = 0, size = names.size(rt); i < size; i++) {
        auto name = names.getValueAtIndex(rt, i).getString(rt);
        result.items.push_back(toMixed(rt, object.getProperty(rt, jsi::PropNameID::forString(rt, name)), ancestors));
        result.keys.push_back(name.utf8(rt));
      }
    }
    ancestors.pop_back();
  } else {
    throw jsi::JSError(rt, "echoMixed accepts only JSON-like values");
  }
  return result;
}

// Defines an own data property. For a "__proto__" key, setProperty would run
// Object.prototype's __proto__ setter instead.
void defineProperty(jsi::Runtime &rt, const jsi::Object &object, const std::string &key, jsi::Value value) {
  if (key != "__proto__") {
    object.setProperty(rt, jsi::PropNameID::forUtf8(rt, key), std::move(value));
    return;
  }
  auto descriptor = jsi::Object(rt);
  descriptor.setProperty(rt, "value", std::move(value));
  descriptor.setProperty(rt, "writable", true);
  descriptor.setProperty(rt, "enumerable", true);
  descriptor.setProperty(rt, "configurable", true);
  rt.global()
      .getPropertyAsObject(rt, "Object")
      .getPropertyAsFunction(rt, "defineProperty")
      .call(rt, object, jsi::String::createFromUtf8(rt, key), descriptor);
}

jsi::Value fromMixed(jsi::Runtime &rt, const Mixed &mixed) {
  switch (mixed.kind) {
    case Mixed::Kind::Undefined:
      return jsi::Value::undefined();
    case Mixed::Kind::Null:
      return jsi::Value::null();
    case Mixed::Kind::Boolean:
      return {mixed.boolean};
    case Mixed::Kind::Number:
      return {mixed.number};
    case Mixed::Kind::String:
      return jsi::String::createFromUtf8(rt, mixed.string);
    case Mixed::Kind::Array: {
      auto array = jsi::Array(rt, mixed.items.size());
      for (size_t i = 0; i < mixed.items.size(); i++) {
        array.setValueAtIndex(rt, i, fromMixed(rt, mixed.items[i]));
      }
      return array;
    }
    case Mixed::Kind::Object: {
      auto object = jsi::Object(rt);
      for (size_t i = 0; i < mixed.keys.size(); i++) {
        defineProperty(rt, object, mixed.keys[i], fromMixed(rt, mixed.items[i]));
      }
      return object;
    }
  }
  return jsi::Value::undefined();
}

} // namespace

NativeRoundTripCxx::NativeRoundTripCxx(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeRoundTripCxxCxxSpec(std::move(jsInvoker)) {}

jsi::ArrayBuffer NativeRoundTripCxx::echoArrayBuffer(jsi::Runtime &rt, jsi::ArrayBuffer value) {
  auto copy = AsyncArrayBuffer::copy(rt, value);
  return rt.createArrayBuffer(copy.getMutableBuffer());
}

jsi::Value NativeRoundTripCxx::echoMixed(jsi::Runtime &rt, jsi::Value value) {
  std::vector<jsi::Object> ancestors;
  return fromMixed(rt, toMixed(rt, value, ancestors));
}

// File I/O runs on a detached thread; the promise settles back on the JS
// thread through the CallInvoker. An exception escaping the thread would
// terminate the app, so every failure rejects instead.
AsyncPromise<int32_t> NativeRoundTripCxx::writeBytes(jsi::Runtime &rt, std::string path, jsi::ArrayBuffer value) {
  AsyncPromise<int32_t> promise(rt, jsInvoker_);
  auto bytes = AsyncArrayBuffer::copy(rt, value);
  std::thread([promise, path = std::move(path), bytes = std::move(bytes)]() mutable {
    try {
      std::ofstream file(path, std::ios::binary | std::ios::trunc);
      file.write(reinterpret_cast<const char *>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
      file.close();
      if (file.fail()) {
        promise.reject(Error("Could not write " + path));
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
      std::ifstream file(path, std::ios::binary | std::ios::ate);
      auto size = file ? static_cast<std::streamsize>(file.tellg()) : -1;
      if (size < 0) {
        promise.reject(Error("Could not read " + path));
        return;
      }
      std::vector<uint8_t> bytes(static_cast<size_t>(size));
      file.seekg(0);
      // read fails unless it fills the buffer.
      if (!file.read(reinterpret_cast<char *>(bytes.data()), size)) {
        promise.reject(Error("Could not read all of " + path));
        return;
      }
      promise.resolve(AsyncArrayBuffer::wrap(std::move(bytes)));
    } catch (const std::exception &e) {
      promise.reject(Error("Could not read " + path + ": " + e.what()));
    }
  }).detach();
  return promise;
}

} // namespace facebook::react
