// vite.config.ts aliases react-native to this file: react-native-web, plus a
// TurboModuleRegistry so the codegen specs in specs/ load on web unchanged.
export * from 'react-native-web';
export * as TurboModuleRegistry from './turboModules';
