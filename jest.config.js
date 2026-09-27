/**
 * Jest configuration.
 *
 * The `jest-expo` preset is the supported way to run React Native components
 * under Node — it supplies the RN module mocks, the transform for JSX/TS, and
 * the platform shims. Hand-rolling that setup is how test suites end up
 * diverging from the runtime they claim to represent.
 *
 * These tests cover COMPONENT RENDERING, which the node:test suites cannot:
 * a component can typecheck and still throw on first render (bad hook order,
 * an undefined style key, a missing provider). That class of bug is otherwise
 * only found on a device.
 *
 * Pure logic stays in `npm test` (node --test) where it runs with no transform.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.tsx'],
  // tsconfig `paths` are a TypeScript-only feature; Jest needs them spelled out
  // or every `@/...` import fails to resolve.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // node_modules ships untranspiled ESM that Jest cannot parse; these are the
  // packages that actually need the babel pass.
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
