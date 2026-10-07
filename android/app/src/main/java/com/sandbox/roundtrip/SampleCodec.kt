package com.sandbox.roundtrip

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

// Converts between the bridge's ReadableMap/WritableMap and a JSONObject, with a typed getter or
// setter for each field of the Sample type in specs/NativeRoundTrip.ts.

internal fun decodePoint(map: ReadableMap): JSONObject =
    JSONObject().put("x", map.getDouble("x")).put("y", map.getDouble("y"))

internal fun encodePoint(json: JSONObject): WritableMap =
    Arguments.createMap().apply {
      putDouble("x", json.getDouble("x"))
      putDouble("y", json.getDouble("y"))
    }

internal fun decodeSample(map: ReadableMap): JSONObject {
  val strings = map.array("strings")
  val matrix = map.array("matrix")
  val points = map.array("points")
  return JSONObject().apply {
    put("text", map.getString("text"))
    put("number", map.getDouble("number"))
    put("int32", map.getInt("int32"))
    put("floatValue", map.getDouble("floatValue"))
    put("doubleValue", map.getDouble("doubleValue"))
    put("flag", map.getBoolean("flag"))
    put("stringLiteral", map.getString("stringLiteral"))
    put("numberLiteral", map.getInt("numberLiteral"))
    put("booleanLiteral", map.getBoolean("booleanLiteral"))
    put("stringUnion", map.getString("stringUnion"))
    put("numberUnion", map.getInt("numberUnion"))
    put("objectUnion", map.map("objectUnion").toJson())
    put("stringEnum", map.getString("stringEnum"))
    put("numberEnum", map.getInt("numberEnum"))
    put("nullableText", if (map.isNull("nullableText")) JSONObject.NULL else map.getString("nullableText"))
    if (map.hasKey("optionalNumber") && !map.isNull("optionalNumber")) {
      put("optionalNumber", map.getDouble("optionalNumber"))
    }
    put("strings", JSONArray().apply { for (i in 0 until strings.size()) put(strings.getString(i)) })
    put(
        "matrix",
        JSONArray().apply {
          for (i in 0 until matrix.size()) {
            val row = requireNotNull(matrix.getArray(i))
            put(JSONArray().apply { for (j in 0 until row.size()) put(row.getDouble(j)) })
          }
        },
    )
    put(
        "points",
        JSONArray().apply {
          for (i in 0 until points.size()) put(decodePoint(requireNotNull(points.getMap(i))))
        },
    )
    put("point", decodePoint(map.map("point")))
    put("dictionary", map.map("dictionary").toJson())
    put("object", map.map("object").toJson())
  }
}

internal fun encodeSample(json: JSONObject): WritableMap {
  val strings = json.getJSONArray("strings")
  val matrix = json.getJSONArray("matrix")
  val points = json.getJSONArray("points")
  return Arguments.createMap().apply {
    putString("text", json.getString("text"))
    putDouble("number", json.getDouble("number"))
    putInt("int32", json.getInt("int32"))
    putDouble("floatValue", json.getDouble("floatValue"))
    putDouble("doubleValue", json.getDouble("doubleValue"))
    putBoolean("flag", json.getBoolean("flag"))
    putString("stringLiteral", json.getString("stringLiteral"))
    putInt("numberLiteral", json.getInt("numberLiteral"))
    putBoolean("booleanLiteral", json.getBoolean("booleanLiteral"))
    putString("stringUnion", json.getString("stringUnion"))
    putInt("numberUnion", json.getInt("numberUnion"))
    putMap("objectUnion", json.getJSONObject("objectUnion").toWritableMap())
    putString("stringEnum", json.getString("stringEnum"))
    putInt("numberEnum", json.getInt("numberEnum"))
    if (json.isNull("nullableText")) {
      putNull("nullableText")
    } else {
      putString("nullableText", json.getString("nullableText"))
    }
    if (json.has("optionalNumber")) {
      putDouble("optionalNumber", json.getDouble("optionalNumber"))
    }
    putArray(
        "strings",
        Arguments.createArray().apply {
          for (i in 0 until strings.length()) pushString(strings.getString(i))
        },
    )
    putArray(
        "matrix",
        Arguments.createArray().apply {
          for (i in 0 until matrix.length()) {
            val row = matrix.getJSONArray(i)
            pushArray(
                Arguments.createArray().apply {
                  for (j in 0 until row.length()) pushDouble(row.getDouble(j))
                }
            )
          }
        },
    )
    putArray(
        "points",
        Arguments.createArray().apply {
          for (i in 0 until points.length()) pushMap(encodePoint(points.getJSONObject(i)))
        },
    )
    putMap("point", encodePoint(json.getJSONObject("point")))
    putMap("dictionary", json.getJSONObject("dictionary").toWritableMap())
    putMap("object", json.getJSONObject("object").toWritableMap())
  }
}

private fun ReadableMap.array(name: String): ReadableArray = requireNotNull(getArray(name))

private fun ReadableMap.map(name: String): ReadableMap = requireNotNull(getMap(name))

// Untyped fields (UnsafeObject, dictionaries, and object unions) convert by ReadableType.

private fun ReadableMap.toJson(): JSONObject {
  val json = JSONObject()
  val keys = keySetIterator()
  while (keys.hasNextKey()) {
    val key = keys.nextKey()
    json.put(
        key,
        when (getType(key)) {
          ReadableType.Null -> JSONObject.NULL
          ReadableType.Boolean -> getBoolean(key)
          ReadableType.Number -> getDouble(key)
          ReadableType.String -> getString(key)
          ReadableType.Map -> map(key).toJson()
          ReadableType.Array -> array(key).toJson()
        },
    )
  }
  return json
}

private fun ReadableArray.toJson(): JSONArray {
  val json = JSONArray()
  for (i in 0 until size()) {
    json.put(
        when (getType(i)) {
          ReadableType.Null -> JSONObject.NULL
          ReadableType.Boolean -> getBoolean(i)
          ReadableType.Number -> getDouble(i)
          ReadableType.String -> getString(i)
          ReadableType.Map -> requireNotNull(getMap(i)).toJson()
          ReadableType.Array -> requireNotNull(getArray(i)).toJson()
        }
    )
  }
  return json
}

private fun JSONObject.toWritableMap(): WritableMap {
  val map = Arguments.createMap()
  for (key in keys()) {
    when (val value = get(key)) {
      JSONObject.NULL -> map.putNull(key)
      is Boolean -> map.putBoolean(key, value)
      is Number -> map.putDouble(key, value.toDouble())
      is String -> map.putString(key, value)
      is JSONObject -> map.putMap(key, value.toWritableMap())
      is JSONArray -> map.putArray(key, value.toWritableArray())
    }
  }
  return map
}

private fun JSONArray.toWritableArray(): WritableArray {
  val array = Arguments.createArray()
  for (i in 0 until length()) {
    when (val value = get(i)) {
      JSONObject.NULL -> array.pushNull()
      is Boolean -> array.pushBoolean(value)
      is Number -> array.pushDouble(value.toDouble())
      is String -> array.pushString(value)
      is JSONObject -> array.pushMap(value.toWritableMap())
      is JSONArray -> array.pushArray(value.toWritableArray())
    }
  }
  return array
}
