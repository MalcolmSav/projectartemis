/**
 * @type {import('@bacons/apple-targets').Config}
 *
 * Declares the Live Activity widget extension. `@bacons/expo-apple-targets`
 * compiles every .swift file placed next to this config into the widget target.
 */
module.exports = {
  type: 'widget',
  name: 'ArtemisWidget',
  // Live Activities require iOS 16.2+ for the current ActivityKit content API.
  deploymentTarget: '16.2',
  colors: {
    $accent: '#C9A84C',
    $background: '#0E0A13',
  },
};
