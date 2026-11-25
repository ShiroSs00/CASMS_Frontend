const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaults = config.resolver.blockList;
// Generated Gradle caches/stages are tooling artifacts, never application input.
config.resolver.blockList = [
  ...(Array.isArray(defaults) ? defaults : defaults ? [defaults] : []),
  /(?:^|[/\\])\.native-build(?:[/\\]|$)/,
];

module.exports = config;
