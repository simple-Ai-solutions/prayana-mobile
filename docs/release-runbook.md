# Prayana Mobile — Release Runbook

Single source of truth for shipping the customer + vendor apps to TestFlight, Play Internal Track, and production stores.

---

## 0. One-time setup (do these once per app, then never again)

### Apple Developer Program

1. Enroll at developer.apple.com (₹8,200/year, 24–48h approval).
2. In App Store Connect → My Apps, create two app records:
   - **Prayana AI** — bundle id `com.prayanaai.customer`, primary language English (India), category Travel, sub-category Travel & Local.
   - **Prayana Business** — bundle id `com.prayanaai.business`, primary language English (India), category Business.
3. Note the `appleId` (the email), the `ascAppId` (the numeric App Store Connect id from the URL), and the `appleTeamId` (10-char from developer.apple.com → Membership).
4. Update both `eas.json` files: replace `REPLACE_WITH_APPLE_ID@example.com`, `REPLACE_WITH_ASC_APP_ID`, `REPLACE_WITH_APPLE_TEAM_ID`.

### Google Play Console

1. Create developer account at play.google.com/console ($25 lifetime).
2. Create two apps:
   - **Prayana AI** — package `com.prayanaai.customer`, default language en-IN.
   - **Prayana Business** — package `com.prayanaai.business`.
3. Generate a Play API service account:
   - Cloud Console → IAM → Service Accounts → create → grant `Service Account User`.
   - Generate JSON key → save as `prayana-mobile/keystores/play-store-service-account.json`.
   - Play Console → Setup → API access → link the service account, grant Release Manager + View financial data.
4. Add `keystores/` to `.gitignore` (already ignored via global .env rule, but verify).

### EAS

1. `npm i -g eas-cli && eas login` (use the prayanaai Expo account).
2. `cd apps/customer && eas init --id <leave blank to create new>` — copy the resulting projectId into both `app.json` (extra.eas.projectId) and `updates.url` (`https://u.expo.dev/<projectId>`).
3. Repeat for vendor: `cd apps/vendor && eas init`.
4. `eas credentials` for each app on each platform — let EAS generate keystores for Android and provisioning for iOS (it stores them on the EAS server; never check them in).

### Sentry

1. Create a Sentry project at sentry.io for each app: `prayana-customer-mobile` and `prayana-vendor-mobile`.
2. Copy the DSN → set as `EXPO_PUBLIC_SENTRY_DSN` in each app's `.env` (and in EAS env: `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>`).
3. The `@sentry/react-native/expo` plugin in `app.json` handles source-map upload automatically during `eas build`. No further wiring needed.

### Firebase

1. Already configured (project `prayanaai-d52cc`). Ensure each app's bundle id is registered as an iOS app and an Android app in Firebase console.
2. Download `GoogleService-Info.plist` (iOS) and `google-services.json` (Android). Place them in the respective app root next to `app.json`. They are git-ignored — distribute via 1Password/secret store.

### Universal links (https://prayanaai.com/app/...)

Domain owner needs to host two AASA/Asset files:

```
https://prayanaai.com/.well-known/apple-app-site-association
https://prayanaai.com/.well-known/assetlinks.json
```

Templates in [universal-links/](./universal-links/) (TBD — generate after you have the team id and SHA-256 fingerprints from `eas credentials`).

---

## 1. Local dev cycle

```bash
# Customer (Razorpay needs a native build, not Expo Go)
cd apps/customer
npx expo prebuild --clean        # only when native deps change
npx expo run:ios                 # iOS simulator
npx expo run:android             # Android emulator

# Vendor
cd apps/vendor
npx expo run:ios
npx expo run:android
```

**Razorpay test cards:** `4111 1111 1111 1111`, any future expiry, any CVV, OTP `123456`.

---

## 2. Internal preview build (for TestFlight + Play Internal)

```bash
# From repo root
npm run build:customer:preview      # → triggers `eas build --profile preview --platform all`
npm run build:vendor:preview
```

Outputs both an iOS `.ipa` (signable for TestFlight) and an Android `.apk` (sideloadable for Play Internal). Build time: ~12–18 min per platform.

When done:
```bash
cd apps/customer
eas submit --platform ios --profile production --latest      # TestFlight
eas submit --platform android --profile production --latest  # Play Internal
```

---

## 3. Production release

```bash
# Customer
cd apps/customer
npm version patch                   # bump version in package.json + app.json (or use eas appVersionSource)
eas build --profile production --platform all
eas submit --platform all --profile production --latest
```

Both stores will receive the build and put it in their respective review queues:
- iOS App Store: 24–48h review.
- Play Store: a few hours for first submission, then minutes for updates.

---

## 4. Over-the-air (OTA) updates — JS-only fixes

For bug fixes that don't touch native code (i.e., no new native modules, no permission changes):

```bash
cd apps/customer
eas update --branch production --message "Fix: booking screen typo"
```

Pushes a JS bundle to all installed apps on the `production` channel within minutes. No store review needed. **Native changes still require a full build** — version your `runtimeVersion` so OTA never lands on incompatible binaries.

---

## 5. Release checklist (per ship)

Run through this every release, both apps:

### Pre-flight (5 min)

- [ ] `npm test` passes (currently no tests; add before first prod release)
- [ ] `npx tsc --noEmit` runs in both apps (remaining errors are pre-existing in JS modules)
- [ ] `eas-cli` is logged in: `eas whoami`
- [ ] Local `.env` has the right Razorpay key id (test for preview, live for prod)
- [ ] App version in `app.json` is bumped
- [ ] `runtimeVersion` matches if you broke native compat
- [ ] Git is clean / on the right branch

### Build (15–30 min, parallel)

- [ ] `eas build --profile production --platform ios`
- [ ] `eas build --profile production --platform android`
- [ ] Both builds succeed with no warnings about missing entitlements

### Smoke test on real devices (15 min)

Critical paths only — every release. Test on iOS + Android, on a physical device, with the production API URL.

- [ ] Open app, sign in with Google
- [ ] Open app, sign in with phone OTP (real SMS arrives)
- [ ] Browse activities, open detail, click Book
- [ ] Complete a booking with Razorpay test card → see confirmation
- [ ] Open my-bookings, see the booking
- [ ] Cancel that booking → see refund banner
- [ ] Open eSIM, browse plans, run KYC stub flow (don't pay real money)
- [ ] Open Packages, open Transport — they load and don't crash
- [ ] Open profile → Identity Vault → add a passport (test value), confirm it persists
- [ ] Open profile → Notifications → toggle a switch, force-quit app, re-open, confirm it persisted
- [ ] Tap a `prayana://activity/abc` deep link from another app — should land on activity detail
- [ ] Receive a push notification (use Expo's push tool: https://expo.dev/notifications) — tap it → should deep-link

For vendor:
- [ ] Sign in with Google
- [ ] Open earnings → see real balance + payout history
- [ ] Open reviews → see customer reviews → reply to one
- [ ] Open support → create a ticket → reply to it
- [ ] Open an activity → variants → add a Standard variant
- [ ] Open an activity → time slots → add a 9 AM slot
- [ ] Force-quit, re-open — auth persisted

### Submit

- [ ] `eas submit --platform ios --profile production --latest`
- [ ] `eas submit --platform android --profile production --latest`
- [ ] In App Store Connect, fill out the new build's metadata (what's new, screenshots) and submit for review.
- [ ] In Play Console, promote the build from Internal → Closed → Open → Production over 1–7 days as confidence grows.

### Post-release (within 1h of going live)

- [ ] Sentry: confirm 0 new crashes.
- [ ] Backend logs: confirm no spike in 4xx/5xx from mobile user-agents.
- [ ] Firebase Analytics (or our `/analytics/event` endpoint): traffic is flowing.
- [ ] Open the live app from Play / App Store on a clean device, repeat the smoke test.

---

## 6. What to do when a release is bad

**Native bug discovered:**
1. Pull the build from public access:
   - Play: pause rollout in Play Console.
   - iOS: contact App Review for an expedited review or pull the version from sale.
2. Cherry-pick the fix → bump version → rebuild → submit.

**JS-only bug discovered:**
1. Fix the bug locally.
2. `eas update --branch production --message "<short reason>"`.
3. All open apps will pull the fix on next launch within minutes.

---

## 7. Common gotchas

| Gotcha | Fix |
|---|---|
| Razorpay returns `BAD_REQUEST_ERROR` | Server's `RAZORPAY_KEY_SECRET` doesn't match the public key id sent to the SDK. Confirm both are test or both are live. |
| Push token registration silently fails | EAS projectId in `app.json` is empty or still has `REPLACE_WITH`. Run `eas init` and copy the new projectId in. |
| iOS universal links don't resolve | AASA file isn't reachable at exactly `https://prayanaai.com/.well-known/apple-app-site-association` (no extension, served as `application/json`). Test with `npx uri-scheme open https://prayanaai.com/app/foo --ios`. |
| Android app links don't auto-verify | `assetlinks.json` SHA-256 doesn't match the prod keystore. Run `keytool -list -v` against the EAS-managed keystore (download via `eas credentials`). |
| ATT prompt never shows | iOS only shows it once per install. Reset with Settings → Privacy → Tracking → toggle. |
| Hot-reload breaks Razorpay | RN modules don't survive Metro reloads cleanly. After touching `paymentService.ts`, do a hard restart: `r r r r` or kill the app. |
| Sentry events missing source maps | The `@sentry/react-native/expo` plugin needs a `SENTRY_AUTH_TOKEN` in EAS env. Set it once: `eas secret:create --name SENTRY_AUTH_TOKEN --value <auth>`. |
