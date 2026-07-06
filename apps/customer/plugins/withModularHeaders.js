// Expo config plugin: enable modular headers for the Google/Firebase pods.
//
// GoogleSignIn pulls in AppCheckCore (a Swift pod) which depends on GoogleUtilities
// and RecaptchaInterop. Those don't define modules, so as static libraries they
// can't be imported from Swift — pod install fails with:
//   "The following Swift pods cannot yet be integrated as static libraries: AppCheckCore..."
//
// A global use_modular_headers! collides with React Native's own module maps
// (Redefinition of module 'react_runtime') when RN builds from source, so we set
// :modular_headers => true only for the specific offending pods. This runs during
// `expo prebuild` (including on EAS cloud), so it survives clean regeneration.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POD_LINES = `
  # withModularHeaders: Google/Firebase pods need modular headers (AppCheckCore is Swift)
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
  pod 'AppCheckCore', :modular_headers => true
  pod 'GoogleSignIn', :modular_headers => true
  pod 'GTMSessionFetcher', :modular_headers => true
  pod 'GTMAppAuth', :modular_headers => true
  pod 'AppAuth', :modular_headers => true
`;

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes('withModularHeaders')) return cfg; // idempotent

      // Insert the pod overrides just after `use_expo_modules!` inside the target block.
      if (contents.includes('use_expo_modules!')) {
        contents = contents.replace('use_expo_modules!', `use_expo_modules!\n${POD_LINES}`);
      } else {
        // Fallback: after the target line.
        contents = contents.replace(/(target ['"][^'"]+['"] do\n)/, `$1${POD_LINES}\n`);
      }
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
