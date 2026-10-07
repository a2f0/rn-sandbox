import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Implemented once in C++ (shared/NativeRoundTripCxx.cpp) for iOS and Android,
// and in TypeScript (web/RoundTripCxxModule.ts). Codegen supports these types
// only in C++ TurboModules: Java rejects ArrayBuffer, and outside C++ modules
// UnsafeMixed becomes a generic object.
export interface Spec extends TurboModule {
  echoArrayBuffer(value: ArrayBuffer): ArrayBuffer;
  echoMixed(value: CodegenTypes.UnsafeMixed): CodegenTypes.UnsafeMixed;

  // Binary file I/O; paths come from NativeRoundTrip's filesDirectory.
  writeBytes(path: string, value: ArrayBuffer): Promise<CodegenTypes.Int32>;
  readBytes(path: string): Promise<ArrayBuffer>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeRoundTripCxx');
