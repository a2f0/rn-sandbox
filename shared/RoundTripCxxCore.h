#pragma once

#include <cstdint>
#include <fstream>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

// The parts of the C++ TurboModule that don't depend on a JavaScript engine:
// the rules for copying `mixed` values, and file I/O. The JSI module
// (NativeRoundTripCxx.cpp, on iOS and Android) and the Embind bindings
// (web/wasm/RoundTripCxxWasm.cpp, compiled to WebAssembly for the web) each
// supply an Engine and run this same code.
namespace roundtrip {

enum class Kind { Undefined, Null, Boolean, Number, String, Array, Object, Other };

// A JSON-like value held entirely in C++, so echoMixed returns a deep copy
// rather than the JS value it was given.
struct Mixed {
  Kind kind = Kind::Undefined;
  bool boolean = false;
  double number = 0;
  std::string string;
  // Array elements, or object values in the order of keys.
  std::vector<Mixed> items;
  std::vector<std::string> keys;
};

// A value echoMixed can't copy. Each binding turns it into a JS error.
class MixedError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

// Nesting deeper than this throws instead of overflowing the native stack.
constexpr size_t kMaxDepth = 256;

// An Engine wraps JavaScript values as Engine::Value, and provides:
//   kind(value), with Other for anything not JSON-like (functions,
//     ArrayBuffers, symbols, bigints);
//   toBoolean, toNumber, and toString (UTF-8) for primitives;
//   elements(array), and entries(object) in for...in order;
//   same(a, b), whether two values are the same object; copy(value);
//   and makeUndefined, makeNull, make(bool | double | std::string),
//   makeArray(elements), and makeObject(entries), which defines own
//   properties, even one named __proto__.

// ancestors holds the objects enclosing value, to reject cycles.
template <typename Engine>
Mixed toMixed(Engine &engine, const typename Engine::Value &value, std::vector<typename Engine::Value> &ancestors) {
  Mixed result;
  result.kind = engine.kind(value);
  switch (result.kind) {
    case Kind::Undefined:
    case Kind::Null:
      break;
    case Kind::Boolean:
      result.boolean = engine.toBoolean(value);
      break;
    case Kind::Number:
      result.number = engine.toNumber(value);
      break;
    case Kind::String:
      result.string = engine.toString(value);
      break;
    case Kind::Array:
    case Kind::Object: {
      for (const auto &ancestor : ancestors) {
        if (engine.same(ancestor, value)) {
          throw MixedError("echoMixed can't copy a cyclic value");
        }
      }
      if (ancestors.size() == kMaxDepth) {
        throw MixedError("echoMixed accepts values nested at most " + std::to_string(kMaxDepth) + " deep");
      }
      ancestors.push_back(engine.copy(value));
      if (result.kind == Kind::Array) {
        for (const auto &element : engine.elements(value)) {
          result.items.push_back(toMixed(engine, element, ancestors));
        }
      } else {
        for (auto &[key, item] : engine.entries(value)) {
          result.items.push_back(toMixed(engine, item, ancestors));
          result.keys.push_back(std::move(key));
        }
      }
      ancestors.pop_back();
      break;
    }
    case Kind::Other:
      throw MixedError("echoMixed accepts only JSON-like values");
  }
  return result;
}

template <typename Engine>
typename Engine::Value fromMixed(Engine &engine, const Mixed &mixed) {
  switch (mixed.kind) {
    case Kind::Null:
      return engine.makeNull();
    case Kind::Boolean:
      return engine.make(mixed.boolean);
    case Kind::Number:
      return engine.make(mixed.number);
    case Kind::String:
      return engine.make(mixed.string);
    case Kind::Array: {
      std::vector<typename Engine::Value> elements;
      for (const auto &item : mixed.items) {
        elements.push_back(fromMixed(engine, item));
      }
      return engine.makeArray(std::move(elements));
    }
    case Kind::Object: {
      std::vector<std::pair<std::string, typename Engine::Value>> entries;
      for (size_t i = 0; i < mixed.keys.size(); i++) {
        entries.emplace_back(mixed.keys[i], fromMixed(engine, mixed.items[i]));
      }
      return engine.makeObject(std::move(entries));
    }
    case Kind::Undefined:
    case Kind::Other:
      break;
  }
  return engine.makeUndefined();
}

// Replaces the file at path with bytes. Returns an error message on failure.
inline std::optional<std::string> writeFile(const std::string &path, const uint8_t *bytes, size_t size) {
  std::ofstream file(path, std::ios::binary | std::ios::trunc);
  file.write(reinterpret_cast<const char *>(bytes), static_cast<std::streamsize>(size));
  file.close();
  if (file.fail()) {
    return "Could not write " + path;
  }
  return std::nullopt;
}

struct ReadResult {
  std::vector<uint8_t> bytes;
  // Set when the file couldn't be read in full.
  std::optional<std::string> error;
};

inline ReadResult readFile(const std::string &path) {
  std::ifstream file(path, std::ios::binary | std::ios::ate);
  auto size = file ? static_cast<std::streamsize>(file.tellg()) : -1;
  if (size < 0) {
    return {{}, "Could not read " + path};
  }
  std::vector<uint8_t> bytes(static_cast<size_t>(size));
  file.seekg(0);
  // read fails unless it fills the buffer.
  if (!file.read(reinterpret_cast<char *>(bytes.data()), size)) {
    return {{}, "Could not read all of " + path};
  }
  return {std::move(bytes), std::nullopt};
}

} // namespace roundtrip
