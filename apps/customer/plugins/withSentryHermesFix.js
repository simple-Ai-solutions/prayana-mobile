// Expo config plugin: strip Sentry's Hermes sampling-profiler flags on iOS.
//
// @sentry/react-native's RNSentry.mm compiles calls to Hermes APIs
// (enableSamplingProfiler / disableSamplingProfiler / dumpSampledTraceToStream)
// that were removed in the Hermes shipped with RN 0.81. Those calls are guarded
// by the SENTRY_PROFILING_SUPPORTED / SENTRY_PROFILING_ENABLED macros, which the
// RNSentry podspec sets on for this RN version — so the build fails to compile.
//
// This plugin adds a Podfile post_install hook that removes the profiling macros
// from the RNSentry target's preprocessor definitions, compiling that code out
// (crash reporting still works, only the profiler is disabled). It runs during
// `expo prebuild`, so it survives clean installs on EAS cloud builds.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const HOOK = `
  # --- withSentryHermesFix: disable Sentry Hermes sampling profiler (RN 0.81 incompat) ---
  installer.pods_project.targets.each do |t|
    if t.name == 'RNSentry'
      t.build_configurations.each do |config|
        defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = defs.reject { |d| d.to_s.include?('SENTRY_PROFILING_SUPPORTED') || d.to_s.include?('SENTRY_PROFILING_ENABLED') || d.to_s.include?('NEW_HERMES_RUNTIME') }
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
        cflags = config.build_settings['OTHER_CFLAGS']
        if cflags.is_a?(Array)
          config.build_settings['OTHER_CFLAGS'] = cflags.reject { |f| f.to_s.include?('SENTRY_PROFILING_SUPPORTED') }
        end
      end
    end
  end
  # --- end withSentryHermesFix ---
`;

module.exports = function withSentryHermesFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes('withSentryHermesFix')) return cfg; // idempotent

      // Insert into the existing post_install block if present, else append one.
      if (contents.match(/post_install do \|installer\|/)) {
        contents = contents.replace(/post_install do \|installer\|/, `post_install do |installer|\n${HOOK}`);
      } else {
        contents += `\npost_install do |installer|\n${HOOK}\nend\n`;
      }
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
