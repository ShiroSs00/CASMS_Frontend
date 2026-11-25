const { withProjectBuildGradle } = require('expo/config-plugins');

// NFC 4.3 reads compileSdk/targetSdk; Expo SDK 58 defines the *Version names.
// Map the existing values after expo-root-project runs, without changing SDKs
// or modifying the installed library. Revalidate when upgrading NFC or Expo.
module.exports = function withNfcAndroidSdk(config) {
  return withProjectBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') throw new Error('Revalidate NFC SDK aliases for this Gradle format.');
    const marker = '// CASMS NFC SDK aliases';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `\n${marker}\nrootProject.ext.set('compileSdk', rootProject.ext.get('compileSdkVersion'))\nrootProject.ext.set('targetSdk', rootProject.ext.get('targetSdkVersion'))\n`;
    }
    return config;
  });
};
