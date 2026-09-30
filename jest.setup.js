/**
 * Jest setup.
 *
 * Only what the components genuinely need. Mocks live here rather than in each
 * test so a component that starts using a native module does not break every
 * suite that renders it.
 */

jest.setTimeout(30000);


// expo-secure-store is backed by the Android Keystore and has no JS
// implementation under Jest.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
    __reset: () => store.clear(),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));

/*
 * AsyncStorage has no native module under Jest. The package ships an official
 * mock; hand-rolling one here would drift from its API and silently change what
 * the offline cache tests actually exercise.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/*
 * AccessibilityInfo: spy on the real object rather than mocking an internal
 * module path. The path-based mock silently produced `undefined` here — RN's
 * internal layout is not a stable contract — and the failure surfaced as a
 * confusing "Cannot read properties of undefined" inside an unrelated module.
 */
const { AccessibilityInfo } = require('react-native');
jest
  .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
  .mockImplementation(async () => false);
jest
  .spyOn(AccessibilityInfo, 'addEventListener')
  .mockImplementation(() => ({ remove: jest.fn() }));
