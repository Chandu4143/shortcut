// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // React Native's Animated API intentionally keeps mutable values in refs.
      'react-hooks/refs': 'off',
      // Route reset effects (origin/destination changes) are synchronous by design.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
