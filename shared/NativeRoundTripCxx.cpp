#include "NativeRoundTripCxx.h"

#include <fstream>
#include <iterator>
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

Mixed toMixed(jsi::Runtime &rt, const jsi::Value &value) {
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
    if (object.isArray(rt)) {
      auto array = object.getArray(rt);
      result.kind = Mixed::Kind::Array;
      for (size_t i = 0, size = array.size(rt); i < size; i++) {
        result.items.push_back(toMixed(rt, array.getValueAtIndex(rt, i)));
      }
    } else if (object.isFunction(rt) || object.isArrayBuffer(rt)) {
      throw jsi::JSError(rt, "echoMixed accepts only JSON-like values");
    } else {
      auto names = object.getPropertyNames(rt);
      result.kind = Mixed::Kind::Object;
      for (size_t i = 0, size = names.size(rt); i < size; i++) {
        auto key = names.getValueAtIndex(rt, i).getString(rt).utf8(rt);
        result.items.push_back(toMixed(rt, object.getProperty(rt, key.c_str())));
        result.keys.push_back(std::move(key));
      }
    }
  } else {
    throw jsi::JSError(rt, "echoMixed accepts only JSON-like values");
  }
  return result;
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
        object.setProperty(rt, mixed.keys[i].c_str(), fromMixed(rt, mixed.items[i]));
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
  return fromMixed(rt, toMixed(rt, value));
}

// File I/O runs on a detached thread; the promise settles back on the JS
// thread through the CallInvoker.
AsyncPromise<int32_t> NativeRoundTripCxx::writeBytes(jsi::Runtime &rt, std::string path, jsi::ArrayBuffer value) {
  AsyncPromise<int32_t> promise(rt, jsInvoker_);
  auto bytes = AsyncArrayBuffer::copy(rt, value);
  std::thread([promise, path = std::move(path), bytes = std::move(bytes)]() mutable {
    std::ofstream file(path, std::ios::binary | std::ios::trunc);
    file.write(reinterpret_cast<const char *>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    file.close();
    if (file.fail()) {
      promise.reject(Error("Could not write " + path));
    } else {
      promise.resolve(static_cast<int32_t>(bytes.size()));
    }
  }).detach();
  return promise;
}

AsyncPromise<AsyncArrayBuffer> NativeRoundTripCxx::readBytes(jsi::Runtime &rt, std::string path) {
  AsyncPromise<AsyncArrayBuffer> promise(rt, jsInvoker_);
  std::thread([promise, path = std::move(path)]() mutable {
    std::ifstream file(path, std::ios::binary);
    if (!file) {
      promise.reject(Error("Could not read " + path));
      return;
    }
    std::vector<uint8_t> bytes{std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
    promise.resolve(AsyncArrayBuffer::wrap(std::move(bytes)));
  }).detach();
  return promise;
}

} // namespace facebook::react
