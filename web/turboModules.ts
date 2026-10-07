import RoundTripCxxModule from './RoundTripCxxModule';
import RoundTripModule from './RoundTripModule';

// Stands in for React Native's TurboModuleRegistry on web (web/reactNative.ts)
// and in Jest (jest.setup.ts), returning the TypeScript implementations of the
// app's native modules.

const modules: Record<string, unknown> = {
  NativeRoundTrip: RoundTripModule,
  NativeRoundTripCxx: RoundTripCxxModule,
};

export function get<T>(name: string): T | null {
  return (modules[name] as T | undefined) ?? null;
}

export function getEnforcing<T>(name: string): T {
  const module = get<T>(name);
  if (module === null) {
    throw new Error(
      `TurboModuleRegistry.getEnforcing(...): '${name}' could not be found.`,
    );
  }
  return module;
}
