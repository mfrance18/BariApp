module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin (used by react-native-reanimated v4, for
    // the drag-and-drop med/vitamin reordering) must be listed last.
    plugins: [['inline-import', { extensions: ['.sql'] }], 'react-native-worklets/plugin'],
  };
};
