const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro bundler config cho TBS ERP Mobile
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Ho tro them extension neu can
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json'],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        // Bat inline requires de giam cold start time
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
