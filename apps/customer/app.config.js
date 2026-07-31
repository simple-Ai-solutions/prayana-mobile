// Dynamic Expo config — extends the static app.json and injects the native
// Google Maps API key from the environment at build time. The key lives in
// .env / .env.local (gitignored), NOT in source control, so the secret is
// never committed.
//
// MAPS PROVIDER, by platform:
//   • Android → Google Maps (PROVIDER_GOOGLE). Needs the key in the manifest.
//   • iOS     → Apple Maps (MapKit). Needs NO key, and we deliberately DON'T
//     inject googleMapsApiKey on iOS: doing so links the GoogleMaps SDK, and
//     if that key lacks "Maps SDK for iOS" (or is restricted) the map renders
//     BLANK — which is exactly the bug we hit. ItineraryMap already passes
//     `provider={Platform.OS==='android' ? PROVIDER_GOOGLE : undefined}`, so
//     iOS uses Apple Maps; the native side must match by NOT configuring Google
//     Maps on iOS.
const appJson = require('./app.json');

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  '';

module.exports = ({ config }) => {
  // `config` is the resolved app.json; merge our native map key into it.
  const base = config && Object.keys(config).length ? config : appJson.expo;

  return {
    ...base,
    android: {
      ...(base.android || {}),
      config: {
        ...((base.android && base.android.config) || {}),
        ...(GOOGLE_MAPS_API_KEY
          ? { googleMaps: { apiKey: GOOGLE_MAPS_API_KEY } }
          : {}),
      },
    },
    ios: {
      ...(base.ios || {}),
      // NOTE: intentionally NOT setting ios.config.googleMapsApiKey. iOS uses
      // Apple Maps (MapKit), which needs no key. Injecting the Google key here
      // links the GoogleMaps SDK and blanks the map when the key isn't valid for
      // iOS — see the header comment.
      config: {
        ...((base.ios && base.ios.config) || {}),
      },
    },
  };
};
