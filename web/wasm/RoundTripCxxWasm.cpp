// The C++ TurboModule's logic (shared/RoundTripCxxCore.h), bound to
// JavaScript with Embind and compiled to WebAssembly for the web
// (scripts/buildWasm.sh). web/RoundTripCxxModule.ts implements the spec with
// these functions.
//
// Each function returns { value } or { error }; the TypeScript side throws the
// error, so no C++ exception has to cross into JavaScript.

#include "RoundTripCxxCore.h"

#include <emscripten/bind.h>
#include <emscripten/em_js.h>
#include <emscripten/val.h>

using emscripten::val;

namespace {

// The keys of object in for...in order, as JSI's getPropertyNames gives them.
EM_JS(emscripten::EM_VAL, forInKeys, (emscripten::EM_VAL handle), {
  const keys = [];
  for (const key in Emval.toValue(handle)) {
    keys.push(key);
  }
  return Emval.toHandle(keys);
});

// Embind's side of the copy rules in RoundTripCxxCore.h.
class EmvalEngine {
 public:
  using Value = val;

  roundtrip::Kind kind(const val &value) const {
    auto type = value.typeOf().as<std::string>();
    if (type == "undefined") {
      return roundtrip::Kind::Undefined;
    }
    if (value.isNull()) {
      return roundtrip::Kind::Null;
    }
    if (type == "boolean") {
      return roundtrip::Kind::Boolean;
    }
    if (type == "number") {
      return roundtrip::Kind::Number;
    }
    if (type == "string") {
      return roundtrip::Kind::String;
    }
    if (type != "object" || value.instanceof(val::global("ArrayBuffer"))) {
      return roundtrip::Kind::Other;
    }
    if (val::global("Array").call<bool>("isArray", value)) {
      return roundtrip::Kind::Array;
    }
    return roundtrip::Kind::Object;
  }

  bool toBoolean(const val &value) const {
    return value.as<bool>();
  }

  double toNumber(const val &value) const {
    return value.as<double>();
  }

  std::string toString(const val &value) const {
    return value.as<std::string>();
  }

  std::vector<val> elements(const val &array) const {
    std::vector<val> elements;
    for (size_t i = 0, size = array["length"].as<size_t>(); i < size; i++) {
      elements.push_back(array[i]);
    }
    return elements;
  }

  std::vector<std::pair<std::string, val>> entries(const val &object) const {
    auto keys = val::take_ownership(forInKeys(object.as_handle()));
    std::vector<std::pair<std::string, val>> entries;
    for (size_t i = 0, size = keys["length"].as<size_t>(); i < size; i++) {
      val key = keys[i];
      entries.emplace_back(key.as<std::string>(), object[key]);
    }
    return entries;
  }

  bool same(const val &a, const val &b) const {
    return a.strictlyEquals(b);
  }

  val copy(const val &value) const {
    return value;
  }

  val makeUndefined() const {
    return val::undefined();
  }

  val makeNull() const {
    return val::null();
  }

  val make(bool value) const {
    return val(value);
  }

  val make(double value) const {
    return val(value);
  }

  val make(const std::string &value) const {
    return val(value);
  }

  val makeArray(std::vector<val> elements) const {
    auto array = val::array();
    for (size_t i = 0; i < elements.size(); i++) {
      array.set(i, elements[i]);
    }
    return array;
  }

  // Object.defineProperty, unlike assignment, defines a key named __proto__
  // as an own property.
  val makeObject(std::vector<std::pair<std::string, val>> entries) const {
    auto object = val::object();
    auto Object = val::global("Object");
    for (const auto &[key, value] : entries) {
      auto descriptor = val::object();
      descriptor.set("value", value);
      descriptor.set("writable", true);
      descriptor.set("enumerable", true);
      descriptor.set("configurable", true);
      Object.call<void>("defineProperty", object, val(key), descriptor);
    }
    return object;
  }
};

val success(const val &value) {
  auto result = val::object();
  result.set("value", value);
  return result;
}

val failure(const std::string &message) {
  auto result = val::object();
  result.set("error", message);
  return result;
}

std::vector<uint8_t> bytesOf(const val &buffer) {
  auto view = val::global("Uint8Array").new_(buffer);
  std::vector<uint8_t> bytes(view["length"].as<size_t>());
  val(emscripten::typed_memory_view(bytes.size(), bytes.data())).call<void>("set", view);
  return bytes;
}

// slice copies the bytes out of WebAssembly memory into a new ArrayBuffer.
val arrayBufferOf(const std::vector<uint8_t> &bytes) {
  return val(emscripten::typed_memory_view(bytes.size(), bytes.data())).call<val>("slice")["buffer"];
}

val echoArrayBuffer(val buffer) {
  return success(arrayBufferOf(bytesOf(buffer)));
}

val echoMixed(val value) {
  EmvalEngine engine;
  std::vector<val> ancestors;
  try {
    return success(roundtrip::fromMixed(engine, roundtrip::toMixed(engine, value, ancestors)));
  } catch (const roundtrip::MixedError &error) {
    return failure(error.what());
  }
}

// Synchronous: the browser has no threads to give the C++ here. The
// TypeScript side returns a promise.
val writeBytes(std::string path, val buffer) {
  auto bytes = bytesOf(buffer);
  if (auto error = roundtrip::writeFile(path, bytes.data(), bytes.size())) {
    return failure(*error);
  }
  return success(val(static_cast<int32_t>(bytes.size())));
}

val readBytes(std::string path) {
  auto result = roundtrip::readFile(path);
  if (result.error) {
    return failure(*result.error);
  }
  return success(arrayBufferOf(result.bytes));
}

} // namespace

EMSCRIPTEN_BINDINGS(round_trip_cxx) {
  emscripten::function("echoArrayBuffer", &echoArrayBuffer);
  emscripten::function("echoMixed", &echoMixed);
  emscripten::function("writeBytes", &writeBytes);
  emscripten::function("readBytes", &readBytes);
}
