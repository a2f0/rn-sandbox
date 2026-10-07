import type { CodegenTypes, RootTag, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Implemented in Kotlin (android/.../roundtrip), Objective-C++
// (ios/sandbox/RCTNativeRoundTrip.mm), and TypeScript (web/RoundTripModule.ts).
// It covers every type that Java and Objective-C TurboModules accept; the
// C++-only types (ArrayBuffer and mixed) are in NativeRoundTripCxx.ts.

export enum Suit {
  Hearts = 'hearts',
  Spades = 'spades',
}

// Codegen accepts only integer members in number enums.
export enum Priority {
  Low = 1,
  High = 3,
}

export type Direction = 'north' | 'south';

export type Level = 1 | 2 | 3;

export type Point = {
  x: CodegenTypes.Double;
  y: CodegenTypes.Double;
};

// Object unions accept only inline object literals, not type aliases.
export type Shape = { radius: number } | { side: number };

export type Sample = {
  text: string;
  number: number;
  int32: CodegenTypes.Int32;
  floatValue: CodegenTypes.Float;
  doubleValue: CodegenTypes.Double;
  flag: boolean;
  stringLiteral: 'exact';
  numberLiteral: 42;
  booleanLiteral: true;
  stringUnion: Direction;
  numberUnion: Level;
  objectUnion: Shape;
  stringEnum: Suit;
  numberEnum: Priority;
  nullableText: string | null;
  optionalNumber?: number;
  strings: string[];
  matrix: number[][];
  points: Point[];
  point: Point;
  dictionary: { [key: string]: number };
  object: CodegenTypes.UnsafeObject;
};

export type FileInfo = {
  path: string;
  bytes: CodegenTypes.Int32;
};

export interface Spec extends TurboModule {
  getConstants(): {
    platform: string;
    filesDirectory: string;
  };

  echoString(value: string): string;
  echoNumber(value: number): number;
  echoInt32(value: CodegenTypes.Int32): CodegenTypes.Int32;
  echoFloat(value: CodegenTypes.Float): CodegenTypes.Float;
  echoDouble(value: CodegenTypes.Double): CodegenTypes.Double;
  echoBoolean(value: boolean): boolean;
  echoStringLiteral(value: 'exact'): 'exact';
  echoNumberLiteral(value: 42): 42;
  echoBooleanLiteral(value: true): true;
  echoStringUnion(value: Direction): Direction;
  echoNumberUnion(value: Level): Level;
  echoObjectUnion(value: Shape): Shape;
  echoStringEnum(value: Suit): Suit;
  echoNumberEnum(value: Priority): Priority;
  echoNullableString(value: string | null): string | null;
  echoNullableNumber(value: number | null): number | null;
  echoOptionalString(value?: string): string | null;
  echoStringArray(value: string[]): string[];
  echoMatrix(value: number[][]): number[][];
  echoPoint(value: Point): Point;
  echoPoints(value: Point[]): Point[];
  echoDictionary(value: { [key: string]: number }): { [key: string]: number };
  echoObject(value: CodegenTypes.UnsafeObject): CodegenTypes.UnsafeObject;
  echoRootTag(value: RootTag): RootTag;
  echoSample(value: Sample): Sample;

  echoSampleAsync(value: Sample): Promise<Sample>;
  resolveVoid(): Promise<void>;
  rejectPromise(code: string, message: string): Promise<void>;
  echoSampleCallback(value: Sample, callback: (value: Sample) => void): void;

  readonly onSample: CodegenTypes.EventEmitter<Sample>;
  emitSample(value: Sample): void;

  // Writes the sample as JSON to filesDirectory/<name>.json, and reads it back.
  writeSample(name: string, value: Sample): Promise<FileInfo>;
  readSample(name: string): Promise<Sample>;
  deleteFile(name: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeRoundTrip');
