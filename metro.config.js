const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Workaround: Node 24 has IPC clone issues with metro/jest-worker on large bundles.
// Limit transformer workers to reduce per-worker IPC payload.
config.maxWorkers = 2;

module.exports = withNativeWind(config, { input: './global.css' });
