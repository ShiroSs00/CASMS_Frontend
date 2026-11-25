// Expo SDK58 Package.js passes path.join() Windows absolute patterns to tinyglobby.
// Reproduced: native separator pattern exceeds5s; forward-slash pattern returns~101ms.
// Preload only in the isolated prebuild child. Never patch node_modules or app runtime.
function normalizePattern(pattern) {
  if (Array.isArray(pattern)) return pattern.map(normalizePattern);
  return typeof pattern === 'string' && /^[A-Za-z]:\\/.test(pattern) ? pattern.replaceAll('\\', '/') : pattern;
}
module.exports = { normalizePattern };
if (process.platform === 'win32' && process.env.CASMS_EXPO_WINDOWS_GLOB_COMPAT === '1') {
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const expo = require(require.resolve('expo/package.json', { paths: [root] }));
  const plugins = require(require.resolve('@expo/config-plugins/package.json', { paths: [root] }));
  if (!expo.version.startsWith('58.') || !plugins.version.startsWith('58.')) throw new Error('Revalidate the Windows glob workaround before using another Expo SDK.');
  const tiny = require(require.resolve('tinyglobby', { paths: [root] }));
  for (const key of ['glob', 'globSync']) {
    const original = tiny[key];
    tiny[key] = (patterns, options) => original(normalizePattern(patterns), options);
  }
}
