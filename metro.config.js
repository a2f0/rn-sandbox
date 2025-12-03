import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDefaultConfig, mergeConfig } from '@react-native/metro-config';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

export default mergeConfig(getDefaultConfig(__dirname), config);
