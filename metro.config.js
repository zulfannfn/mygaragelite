const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround: Node 24 has IPC clone issues with metro/jest-worker on large bundles.
// Limit transformer workers to reduce per-worker IPC payload.
config.maxWorkers = 2;

// Support expo-sqlite on web (wa-sqlite.wasm)
config.resolver.assetExts.push('wasm');

module.exports = config;

