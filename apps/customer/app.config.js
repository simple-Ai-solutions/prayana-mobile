// Dynamic Expo config — extends the static app.json and injects the native
// Google Maps API key from the environment at build time. The key lives in
// .env / .env.local (gitignored), NOT in source control, so the secret is
// never committed. react-native-maps with PROVIDER_GOOGLE needs this key in
// the native AndroidManifest / iOS plist or the map renders blank.
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
      config: {
        ...((base.ios && base.ios.config) || {}),
        ...(GOOGLE_MAPS_API_KEY ? { googleMapsApiKey: GOOGLE_MAPS_API_KEY } : {}),
      },
    },
  };
};
