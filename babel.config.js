/**
 * React Native 0.86 / Expo SDK 57.
 *
 * Only `babel-preset-expo` is required — since SDK 50 it enables the Reanimated
 * plugin itself, so adding `react-native-reanimated/plugin` here would apply it
 * twice and break worklets. Keep this file minimal on purpose.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
