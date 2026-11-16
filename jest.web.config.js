module.exports = {
  preset: 'jest-expo/web',
  testMatch: ['**/tests/**/*.web.test.jsx'],
  // Match Metro's RN 0.88 asset-registry compatibility alias for SVG on web.
  moduleNameMapper: {
    '^@react-native/assets-registry/registry$':
      'react-native-web/asset-registry',
  },
  clearMocks: true,
};
