# Prayana Mobile — Handoff Document

**Status as of 2026-04-27:** Customer + vendor apps are code-complete for v1 launch. Both apps typecheck clean (0 TS errors). All marketplace flows (browse → book → pay → review → cancel/refund) work end-to-end against the production Express backend.

---

## What's in the box

### Customer app — `apps/customer/`
- 5-tab core: Home, Explore, Create Trip, Trips, Profile
- Activities marketplace with full booking flow + Razorpay payment
- AI trip planner: 4-step wizard, day planner, real-time collab via Socket.IO
- eSIM: real catalogue, KYC upload, Razorpay checkout, QR delivery
- Holiday Packages: search, filter, detail, customizable booking
- Transport: vehicle browse, detail, booking with deposit
- Hotels: polished "Coming Soon" + persistent waitlist (microservice not yet deployed)
- Profile: Saved Places, Identity Vault, Saved Payment Methods, Notification Settings, Travel Preferences (all wired to backend)
- Reviews: list, sort, filter, submit, helpful votes
- Bookings: cancel + refund tracking with status pills
- Trip share: text / public link / iCal
- Push notifications, deep linking (`prayana://...` + `https://prayanaai.com/app/...`)
- Sentry crash reporting + analytics layer (ATT-gated on iOS)

### Vendor app — `apps/vendor/`
- 5-tab core: Dashboard, Activities, Orders, Calendar, More
- Onboarding: multi-step KYC, IFSC autocomplete, document upload
- Activity management: create, edit, variants (Std/VIP/Private), time slots
- Bookings: view, accept, decline, complete
- Reviews management: list, filter (unanswered/≤3 stars), reply
- Support tickets: list, create, reply (chat-bubble UI)
- Earnings: payout summary, history, drill-down detail with UTR copy
- Auth: Google + phone OTP via server-issued Firebase custom token
- Same Sentry + analytics + deep linking infrastructure as customer

### Shared packages — `packages/`
- `shared-services/` — 41 exports: 28 API services, payment, socket, firebase, auth helpers
- `shared-ui/` — 17 exports: Button, Card, Avatar, Badge, TextInput, Stepper, StarRating, EmptyState, ErrorView, LoadingSpinner, SearchBar, PriceDisplay, StatusBadge + theme tokens (colors, spacing, fontSize, fontWeight, borderRadius, shadow, motion, zIndex, layout)
- `shared-hooks/` — 12 hooks: useAuth, useCollaboration, useImageEnrichment, useEnrichmentPolling, useDebounce, etc.
- `shared-stores/` — 8 Zustand stores: auth, chat, trip, search, business, UI
- `shared-utils/` — 15 utilities: country codes, currency, distance, splitwise, etc.
- `shared-types/` — 7 type packs: trip, activity, booking, business, chat, user

---

## Build & ship

**Local dev** (Razorpay needs native build, not Expo Go):
```bash
cd apps/customer && npx expo run:ios
cd apps/vendor && npx expo run:android
```

**Internal preview builds** (TestFlight + Play Internal):
```bash
npm run build:customer:preview
npm run build:vendor:preview
```

**Production builds + submit:**
```bash
npm run build:customer:prod
npm run submit:customer:ios
npm run submit:customer:android
```

**OTA updates** (JS-only fixes, no store review):
```bash
npm run update:customer -- --message "Fix: bug X"
```

Full instructions in [docs/release-runbook.md](release-runbook.md).

---

## Quality gates

| Gate | Command | Status |
|------|---------|--------|
| Customer typecheck | `npm run typecheck:customer` | ✅ 0 errors |
| Vendor typecheck | `npm run typecheck:vendor` | ✅ 0 errors |
| Both | `npm run typecheck` | ✅ 0 errors |
| ESLint | (not configured) | Use TS as the gate; add eslint-config-expo when wanted |

---

## What needs human action before first store submission

These cannot be done from code:

| # | Action | Time |
|---|--------|------|
| 1 | Enroll Apple Developer Program | 24–48h, ₹8,200/yr |
| 2 | Create Google Play Console account | $25 lifetime |
| 3 | Run `eas init` in both apps to get real `projectId`s, paste into both `app.json` files | 5 min |
| 4 | Create Sentry projects (one per app), copy DSNs to `.env` and EAS secrets | 10 min |
| 5 | Place `GoogleService-Info.plist` + `google-services.json` at app roots | 5 min |
| 6 | Host AASA + assetlinks.json on prayanaai.com (universal links) | 30 min DNS |
| 7 | Replace `REPLACE_WITH_*` placeholders in both `eas.json` with Apple ID, ASC App ID, Apple Team ID | 5 min |

After those 7 items, `npm run build:customer:prod && npm run submit:customer:ios` is a one-line ship.

---

## Architecture notes worth knowing

**Env config** — single source of truth in `apps/<app>/src/config/env.ts`. Reads `EXPO_PUBLIC_*` vars and validates required ones at startup. Don't reach for `process.env` in feature code.

**Razorpay** — `openCheckout()` from `@prayana/shared-services` is the one and only payment entry point. Used by Activity, eSIM, Packages, Transport. Server creates the order, mobile opens Razorpay native sheet, server verifies signature. Client never trusts the success callback.

**Sentry** — initialized at app boot with PII scrubbing in `beforeSend`. Strips passport, aadhaar, PAN, DOB, phone, email, card, OTP, signature, secrets, tokens, GST, account numbers, IFSC. `setSentryUser` only sends uid (not email).

**Analytics** — `track(name, props)` from `lib/analytics`. ATT-gated on iOS (events queue until consent). Silent no-op in non-production builds.

**Deep links** — `lib/deepLinks.ts` resolves both `prayana://activity/abc` and `https://prayanaai.com/app/activity/abc` to a router-compatible path. Same resolver normalizes push notification payloads.

**Push notifications** — Skip registration when EAS projectId is empty/placeholder (prevents prod crash). Logs failures without crashing. Push payloads accept both `data.route` (relative) and `data.url` (full URL).

**Auth** — `useAuth` hook (JS) is shadowed by `useAuth.d.ts` for TS. Exposes `user`, `setUser`, `setIsAuthenticated`, `syncWithBackend`, `loginWithEmail`, `loginWithGoogle`, `loginWithPhone`, `logout`.

---

## Where to look when X breaks

| Symptom | Where |
|---------|-------|
| API call fails with 401 | `packages/shared-services/src/apiConfig.js` — `setAuthTokenProvider` wiring |
| Razorpay payment doesn't open | `packages/shared-services/src/paymentService.ts` — checks `react-native-razorpay` is linked |
| Push notifications silent | `apps/<app>/src/app/_layout.tsx` — `PushNotificationManager` component, EAS projectId check |
| Deep link doesn't navigate | `apps/<app>/src/lib/deepLinks.ts` — `resolveDeepLink` regex |
| Sentry events missing | `apps/<app>/src/lib/sentry.ts` — DSN env, `enabled: !__DEV__` |
| Style array errors on Card/Button | `packages/shared-ui/src/{Card,Button}.tsx` — both accept `StyleProp<ViewStyle>` |
| `getReactNativePersistence` not exported | `packages/shared-services/src/firebase.ts` — uses runtime `require` to bypass v12 type drift |

---

## Memory snapshot for future sessions

Phases A–D documented at `~/.claude/projects/.../memory/`:
- `project_mobile_phase_a.md` — Foundation (theme, env, query client, Sentry, Razorpay)
- `project_mobile_phase_b.md` — Customer parity sprint
- `project_mobile_phase_c.md` — Vendor mgmt + customer profile + share/persist
- `project_mobile_phase_d.md` — Release prep
- `project_mobile_parity_scope.md` — Original scope at session start

Plus this handoff doc + the runbook.

---

## What's NOT done (intentional)

- **Hotels** — server microservice (`prayanaai-hotels`) not deployed. Mobile shows polished Coming Soon + waitlist.
- **Vendor pricing rules UI** — bulk discounts / seasonal / date overrides. Backend supports them; only UI missing.
- **Optional polish modules** — Quick Plan, Theme Itineraries, Monuments, Travel Guides, Explore Nearby, Divya Darshana, Global Experiences. None launch-blocking.
- **Multi-language (i18n)** — English-only at launch.
- **ESLint config** — TypeScript strict mode catches the same class of bugs. Add later if you want lint rules.

These are **intentional cuts** to ship v1, not gaps to fix.
