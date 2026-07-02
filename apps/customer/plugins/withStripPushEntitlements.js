// Expo config plugin: strip the push + associated-domains entitlements at the
// end of prebuild.
//
// The expo-notifications package (still a dependency, used at runtime for the
// foreground handler + token registration) auto-adds `aps-environment` to the
// generated iOS entitlements during prebuild, even with its config plugin
// removed. Our App Store provisioning profile can't be issued with the Push
// Notifications / Associated Domains capabilities right now because that needs
// an interactive Apple session (SMS 2FA is failing Apple-side), so the archive
// fails: "profile doesn't include the aps-environment entitlement".
//
// This plugin runs LAST (append it after every other plugin in app.json) and
// deletes those two entitlement keys from the generated entitlements plist, so
// the app's declared capabilities match the profile the API key can issue
// non-interactively. Remove this plugin (and it all comes back automatically)
// once 2FA works and the profile can carry the capabilities again.

const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withStripPushEntitlements(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    delete cfg.modResults['com.apple.developer.associated-domains'];
    return cfg;
  });
};
