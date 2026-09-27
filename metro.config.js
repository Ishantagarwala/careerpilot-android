const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

/**
 * Keep test files out of the app bundle.
 *
 * expo-router discovers routes with `require.context('./app')`, which matches
 * EVERY file under app/ — including `*.test.tsx`. Those import
 * @testing-library/react-native, which pulls in Node built-ins (`console`,
 * `util`), so the Android bundle failed outright with:
 *
 *   Unable to resolve "console" from node_modules/@testing-library/react-native
 *
 * Excluding them at the resolver is the right fix rather than moving the tests:
 * a test next to the screen it covers is the convention worth keeping, and this
 * also strips jest's globals and mocks from the shipped bundle.
 */
const previousBlockList = config.resolver.blockList;

config.resolver.blockList = [
  ...(Array.isArray(previousBlockList)
    ? previousBlockList
    : previousBlockList
      ? [previousBlockList]
      : []),
  // Any *.test.ts / *.test.tsx, anywhere.
  /.*\.test\.(ts|tsx)$/,
  // Jest's own setup/config must never reach the runtime.
  new RegExp(`^${path.resolve(__dirname, 'jest\\.setup\\.js').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
];

module.exports = config;
