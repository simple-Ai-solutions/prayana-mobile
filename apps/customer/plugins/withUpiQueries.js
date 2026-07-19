// Expo config plugin: let Razorpay show the UPI *intent* flow (open PhonePe /
// GPay / Paytm directly) instead of the "enter your UPI ID" collect fallback.
//
// Root cause is app *visibility*, and it bites on BOTH platforms:
//   Android 11+ (API 30): an app can't see another installed app unless it is
//     declared in <queries>. react-native-razorpay declares no UPI queries, so
//     Checkout can't enumerate installed UPI apps and drops to the collect flow.
//   iOS: UIApplication.canOpenURL(upi-scheme) returns false unless the scheme is
//     listed in LSApplicationQueriesSchemes, so Checkout can't detect the UPI
//     apps and again shows collect.
//
// Declaring the UPI intent/packages (Android) and the UPI URL schemes (iOS)
// restores visibility, so Checkout renders the intent buttons and tapping one
// launches the app. Runs during `expo prebuild` (local + EAS), so it survives
// clean regeneration of the native projects.
const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

// Well-known UPI apps we want Checkout to be able to launch by package name.
const UPI_PACKAGES = [
  'com.phonepe.app',
  'com.google.android.apps.nbu.paisa.user', // Google Pay
  'net.one97.paytm', // Paytm
  'in.org.npci.upiapp', // BHIM
  'com.amazon.mShop.android.shopping', // Amazon Pay
  'com.axis.mobile',
  'com.csam.icici.bank.imobile',
  'com.sbi.upi',
];

// iOS URL schemes for the same apps (what canOpenURL checks).
const UPI_IOS_SCHEMES = [
  'phonepe', // PhonePe
  'tez', // Google Pay (Tez)
  'gpay', // Google Pay (newer)
  'paytmmp', // Paytm
  'paytm',
  'bhim', // BHIM
  'upi', // generic UPI
  'credpay', // CRED
  'amazonpay',
];

function withAndroidUpiQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [];

    let queries = manifest.queries[0];
    if (!queries) {
      queries = {};
      manifest.queries.push(queries);
    }

    // upi:// VIEW intent — how Razorpay discovers any UPI-capable app.
    queries.intent = queries.intent || [];
    const hasUpiIntent = queries.intent.some((i) =>
      (i.data || []).some((d) => d.$ && d.$['android:scheme'] === 'upi'),
    );
    if (!hasUpiIntent) {
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'upi' } }],
      });
    }

    // Explicit <package> entries for the major UPI apps.
    queries.package = queries.package || [];
    const declared = new Set(
      queries.package.map((p) => p.$ && p.$['android:name']).filter(Boolean),
    );
    for (const name of UPI_PACKAGES) {
      if (!declared.has(name)) {
        queries.package.push({ $: { 'android:name': name } });
      }
    }

    return cfg;
  });
}

function withIosUpiSchemes(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    const existing = new Set(plist.LSApplicationQueriesSchemes || []);
    for (const scheme of UPI_IOS_SCHEMES) existing.add(scheme);
    plist.LSApplicationQueriesSchemes = Array.from(existing);
    return cfg;
  });
}

module.exports = function withUpiQueries(config) {
  return withIosUpiSchemes(withAndroidUpiQueries(config));
};
