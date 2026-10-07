package com.sandbox.roundtrip

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.sandbox.specs.NativeRoundTripSpec
import java.io.File
import org.json.JSONObject

/**
 * Echoes every type in specs/NativeRoundTrip.ts back to JS. writeSample decodes a sample field by
 * field into a JSONObject (SampleCodec.kt) and stores it; readSample encodes it back.
 */
class NativeRoundTripModule(reactContext: ReactApplicationContext) :
    NativeRoundTripSpec(reactContext) {

  private val filesDirectory: File by lazy {
    File(reactApplicationContext.filesDir, "roundtrip").apply { mkdirs() }
  }

  override fun getTypedExportedConstants(): Map<String, Any> =
      mapOf("platform" to "android", "filesDirectory" to filesDirectory.absolutePath)

  override fun echoString(value: String): String = value

  override fun echoNumber(value: Double): Double = value

  override fun echoInt32(value: Double): Double = value

  override fun echoFloat(value: Double): Double = value

  override fun echoDouble(value: Double): Double = value

  override fun echoBoolean(value: Boolean): Boolean = value

  override fun echoStringLiteral(value: String): String = value

  override fun echoNumberLiteral(value: Double): Double = value

  override fun echoBooleanLiteral(value: Boolean): Boolean = value

  override fun echoStringUnion(value: String): String = value

  override fun echoNumberUnion(value: Double): Double = value

  override fun echoObjectUnion(value: ReadableMap): ReadableMap =
      Arguments.makeNativeMap(value.toHashMap())

  override fun echoStringEnum(value: String): String = value

  override fun echoNumberEnum(value: Double): Double = value

  override fun echoNullableString(value: String?): String? = value

  override fun echoNullableNumber(value: Double?): Double? = value

  override fun echoOptionalString(value: String?): String? = value

  override fun echoStringArray(value: ReadableArray): WritableArray =
      Arguments.createArray().apply {
        for (i in 0 until value.size()) pushString(value.getString(i))
      }

  override fun echoMatrix(value: ReadableArray): WritableArray =
      Arguments.createArray().apply {
        for (i in 0 until value.size()) {
          val row = requireNotNull(value.getArray(i))
          pushArray(Arguments.createArray().apply {
            for (j in 0 until row.size()) pushDouble(row.getDouble(j))
          })
        }
      }

  override fun echoPoint(value: ReadableMap): WritableMap = copyPoint(value)

  override fun echoPoints(value: ReadableArray): WritableArray =
      Arguments.createArray().apply {
        for (i in 0 until value.size()) {
          pushMap(copyPoint(requireNotNull(value.getMap(i))))
        }
      }

  override fun echoDictionary(value: ReadableMap): WritableMap =
      Arguments.createMap().apply {
        val keys = value.keySetIterator()
        while (keys.hasNextKey()) {
          val key = keys.nextKey()
          putDouble(key, value.getDouble(key))
        }
      }

  override fun echoObject(value: ReadableMap): WritableMap =
      Arguments.makeNativeMap(value.toHashMap())

  override fun echoRootTag(value: Double): Double = value

  override fun echoSample(value: ReadableMap): WritableMap = copySample(value)

  override fun echoSampleAsync(value: ReadableMap, promise: Promise) {
    promise.resolve(copySample(value))
  }

  override fun resolveVoid(promise: Promise) {
    promise.resolve(null)
  }

  override fun rejectPromise(code: String, message: String, promise: Promise) {
    promise.reject(code, message)
  }

  override fun echoSampleCallback(value: ReadableMap, callback: Callback) {
    callback.invoke(copySample(value))
  }

  override fun emitSample(value: ReadableMap) {
    emitOnSample(copySample(value))
  }

  override fun writeSample(name: String, value: ReadableMap, promise: Promise) {
    val file = sampleFile(name, promise) ?: return
    settle(promise) {
      val bytes = decodeSample(value).toString().toByteArray(Charsets.UTF_8)
      file.writeBytes(bytes)
      Arguments.createMap().apply {
        putString("path", file.absolutePath)
        putInt("bytes", bytes.size)
      }
    }
  }

  override fun readSample(name: String, promise: Promise) {
    val file = sampleFile(name, promise) ?: return
    if (!file.isFile) {
      promise.reject("E_NOT_FOUND", "No sample named $name")
      return
    }
    settle(promise) { encodeSample(JSONObject(file.readText(Charsets.UTF_8))) }
  }

  override fun deleteFile(name: String, promise: Promise) {
    val file = sampleFile(name, promise) ?: return
    settle(promise) { file.delete() }
  }

  // Rejects with E_IO when reading, writing, or converting a sample throws, as
  // for a NaN, which JSON can't represent, or a corrupt file.
  private inline fun settle(promise: Promise, block: () -> Any?) {
    val result =
        try {
          block()
        } catch (e: Exception) {
          promise.reject("E_IO", e.message ?: e.toString(), e)
          return
        }
    promise.resolve(result)
  }

  private fun sampleFile(name: String, promise: Promise): File? {
    if (!SAFE_NAME.matches(name)) {
      promise.reject("E_INVALID_NAME", "Sample names may only contain letters, digits, - and _")
      return null
    }
    return File(filesDirectory, "$name.json")
  }

  private companion object {
    val SAFE_NAME = Regex("[A-Za-z0-9_-]+")
  }
}
