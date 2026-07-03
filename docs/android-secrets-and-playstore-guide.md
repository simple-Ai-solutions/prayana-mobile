# Prayana AI — Android Secrets Management & Play Store Deployment Guide

> **Convert to PDF:**
> - **VS Code:** Install "Markdown PDF" extension → Right-click this file → "Markdown PDF: Export (pdf)"
> - **Google Docs:** Copy content → Paste → File → Download → PDF
> - **Pandoc CLI:** `pandoc android-secrets-and-playstore-guide.md -o prayana-android-guide.pdf`

---

## Table of Contents

1. [Why Mobile Secrets Are Different from AWS](#why-mobile-secrets-are-different-from-aws)
2. [The Three Tiers of Mobile Secrets](#the-three-tiers-of-mobile-secrets)
3. [Current State of the Project](#current-state-of-the-project)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Environment Configuration Summary](#environment-configuration-summary)
6. [CI/CD with GitHub Actions](#cicd-with-github-actions)
7. [Quick Reference Checklist](#quick-reference-checklist)

---

## Why Mobile Secrets Are Different from AWS

In AWS, your backend server runs in a controlled environment (EC2, Lambda, ECS). At startup it fetches secrets from **AWS Secrets Manager** or **SSM Parameter Store** via an IAM role — secrets never touch the codebase and are injected at **runtime**.

Mobile apps are fundamentally different:

| AWS / Backend | Android App |
|---|---|
| Secrets Manager / SSM Parameter Store | `local.properties` (gitignored) |
| Environment variables injected at runtime | `EXPO_PUBLIC_*` vars baked in at build time |
| IAM role grants access to secrets | Keystore + SHA-1 fingerprint authenticates the app |
| CI/CD injects secrets into the server | GitHub Actions injects secrets during the Gradle build |
| Secrets never in code or repo | Sensitive keys in `.gitignore`'d local files only |

**Key difference:** Mobile app secrets are embedded at **build time**, not fetched at runtime. They live inside the compiled APK/AAB binary.

**The goal is not to make secrets invisible** — a determined attacker with the APK can still extract strings from the binary. The real protection is:
- Restricting API keys to your specific package name + SHA-1 fingerprint in Google Cloud Console
- Your backend validating auth tokens, not just API keys
- Keeping secrets out of your **git repository**

---

## The Three Tiers of Mobile Secrets

### Tier 1 — Public (Safe to Commit to Git)

These are intentionally visible. They're embedded in the app binary which anyone can decompile. Keeping them in git is correct and expected.

| What | Example | Why It's Safe |
|---|---|---|
| OAuth Client IDs | `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` | Google validates the app's SHA-1 fingerprint, not just the client ID |
| Public API base URL | `EXPO_PUBLIC_API_URL` | Your API has its own auth layer (JWT, Firebase Auth) |
| Firebase config | `google-services.json` | Firebase Security Rules protect your data |
| App identifiers | Bundle ID, package name | Publicly visible on the Play Store anyway |

**Rule:** If it starts with `EXPO_PUBLIC_`, it's public by design.

---

### Tier 2 — Build-Time Secrets (Never Commit to Git)

These go into gitignored local files and get baked into the binary at build time.

| What | Where to Store | How It Gets Into the App |
|---|---|---|
| Google Maps API key | `android/local.properties` | `build.gradle` → `manifestPlaceholders` → `AndroidManifest.xml` |
| Production API URL | `.env.production` | Expo build picks it up automatically |
| Stripe / Razorpay public key | `.env.production` | Baked in at build |

**The pattern:**

```
android/local.properties   (gitignored — lives only on developer's machine / CI)
            ↓
    app/build.gradle reads it
            ↓
    manifestPlaceholders inject values into AndroidManifest.xml
            ↓
    APK/AAB compiled with values baked in
```

---

### Tier 3 — Release Signing Credentials (Most Critical)

The release keystore is what makes **your app yours** on the Play Store. Google Play permanently ties app updates to the original signing key.

| What | Where to Store |
|---|---|
| `prayana-release.keystore` file | Password manager (1Password / Bitwarden) + offline secure backup |
| Keystore password | Password manager only — never in any file |
| Key alias | Password manager |
| Key password | Password manager |

> **CRITICAL WARNING:** If you lose your release keystore, you can **NEVER** push an update to your existing app on the Play Store. You would have to publish a completely new app and ask all existing users to uninstall and reinstall. Google provides no recovery process.

---

## Current State of the Project

| Item | Current State | Action Needed |
|---|---|---|
| Google Maps API key | Hardcoded in `AndroidManifest.xml` | Move to `local.properties` |
| OAuth Client IDs | In `.env` as `EXPO_PUBLIC_*` | No change needed — this is correct |
| Release keystore | Not created yet | Generate and store securely |
| API URL | Points to `192.168.x.x` (local network) | Update to production URL before release |
| Environment separation | None | Create `.env.production` |

**Project files involved:**
- `apps/customer/android/app/src/main/AndroidManifest.xml`
- `apps/customer/android/app/build.gradle`
- `apps/customer/android/local.properties` ← create / update this
- `apps/customer/.env`
- `apps/customer/.env.production` ← create this

---

## Step-by-Step Implementation

### Step 1 — Update `local.properties`

The file `apps/customer/android/local.properties` already exists with the Android SDK path. Add secrets to it:

```properties
# Android SDK path (already present — do not remove)
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk

# Google Maps API Key (Android Firebase key from Google Cloud Console)
GOOGLE_MAPS_API_KEY=AIzaSyAPnHWRP2WBUhGiADIdzSBtlKEiL8_YaxE

# Release Keystore — fill in after Step 4
RELEASE_STORE_FILE=/Users/YOUR_USERNAME/prayana-release.keystore
RELEASE_STORE_PASSWORD=your_strong_password_here
RELEASE_KEY_ALIAS=prayana
RELEASE_KEY_PASSWORD=your_strong_password_here
```

> This file is already in `.gitignore`. Never commit it.

---

### Step 2 — Update `app/build.gradle`

Add the following to `apps/customer/android/app/build.gradle`:

**At the very top of the file (after `apply plugin` lines):**

```groovy
// Load secrets from local.properties
def localProps = new Properties()
def localPropsFile = rootProject.file('local.properties')
if (localPropsFile.exists()) {
    localProps.load(localPropsFile.newDataInputStream())
}
```

**Inside the `android { }` block — add `manifestPlaceholders` to `defaultConfig`:**

```groovy
android {
    defaultConfig {
        // ... keep all existing config ...

        manifestPlaceholders = [
            googleMapsApiKey: localProps['GOOGLE_MAPS_API_KEY'] ?: ""
        ]
    }

    signingConfigs {
        release {
            storeFile file(localProps['RELEASE_STORE_FILE'] ?: "debug.keystore")
            storePassword localProps['RELEASE_STORE_PASSWORD'] ?: "android"
            keyAlias localProps['RELEASE_KEY_ALIAS'] ?: "androiddebugkey"
            keyPassword localProps['RELEASE_KEY_PASSWORD'] ?: "android"
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

### Step 3 — Update `AndroidManifest.xml`

In `apps/customer/android/app/src/main/AndroidManifest.xml`, replace the hardcoded Maps API key:

```xml
<!-- BEFORE — remove this hardcoded value -->
<meta-data android:name="com.google.android.geo.API_KEY"
           android:value="AIzaSyAPnHWRP2WBUhGiADIdzSBtlKEiL8_YaxE"/>

<!-- AFTER — use the placeholder injected by build.gradle -->
<meta-data android:name="com.google.android.geo.API_KEY"
           android:value="${googleMapsApiKey}"/>
```

---

### Step 4 — Generate the Release Keystore

Run this command **once**. The keystore file will be created at `~/prayana-release.keystore`.

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

$JAVA_HOME/bin/keytool -genkey -v \
  -keystore ~/prayana-release.keystore \
  -alias prayana \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You'll be prompted to enter:
- **Keystore password** — use something strong (e.g., 20+ chars, mixed case + symbols)
- Your name, organization name, city, state, country code (e.g., `IN` for India)
- **Key password** — can be the same as keystore password

After running, **immediately save to a password manager:**
- The file path: `~/prayana-release.keystore`
- The keystore password
- The key alias: `prayana`
- The key password

---

### Step 5 — Get the Release SHA-1 Fingerprint

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

$JAVA_HOME/bin/keytool -list -v \
  -keystore ~/prayana-release.keystore \
  -alias prayana
```

Look for the line that says **`SHA1:`** in the output. Copy that value — you need it in the next step.

Example output:
```
Certificate fingerprints:
  SHA1: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
  SHA256: ...
```

---

### Step 6 — Register Release SHA-1 in Google Cloud Console

Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**

**Update the Android Maps API key:**
1. Click **"Android key (auto created by Firebase)"**
2. Under **"Android restrictions"** → click **"+ Add an item"**
3. Enter:
   - Package name: `com.prayanaai.customer`
   - SHA-1 certificate fingerprint: `<paste your release SHA-1 from Step 5>`
4. Save

**Update the Android OAuth Client:**
1. Click **"Android client 1"** (the OAuth 2.0 client for Android)
2. Update the SHA-1 certificate fingerprint to the release SHA-1
3. Save

> You now have both the debug SHA-1 and release SHA-1 registered, so both debug and release builds will work.

---

### Step 7 — Create `.env.production`

Create `apps/customer/.env.production` (gitignored):

```bash
# Production API URL — replace with your deployed backend URL
EXPO_PUBLIC_API_URL=https://api.prayanaai.com/api

# Keep the same OAuth Client IDs as .env
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=926782873134-ljojer8isfftfsbtbg93aiskel9p5t14.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=926782873134-iumg64f06ljoird3beif4arrmhsmi5q5.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=926782873134-jloo52dkm4lf8uijogcvlgg24dn49lco.apps.googleusercontent.com
```

Add `.env.production` to `.gitignore` if not already present.

---

### Step 8 — Build the Release AAB

```bash
cd prayana-mobile/apps/customer/android
./gradlew bundleRelease
```

The output file will be at:
```
apps/customer/android/app/build/outputs/bundle/release/app-release.aab
```

This `.aab` file is what you upload to Google Play Console.

---

### Step 9 — Set Up Google Play Console

1. Go to [play.google.com/console](https://play.google.com/console)
2. Click **"Create app"**
   - App name: `Prayana AI`
   - Default language: English (or your preferred)
   - App or game: **App**
   - Free or paid: **Free**
3. Fill out the **Store listing** (description, screenshots, icon)
4. Go to **Release → Internal testing → Create new release**
5. Upload the `app-release.aab` file
6. Add testers under **Testers** tab (add your team's Google account emails)
7. Click **"Save and publish to internal testing"**

You'll get an opt-in link. Share it with testers — they open it on their Android device to install the release build and test Google Sign-In.

---

## Environment Configuration Summary

```
apps/customer/
├── .env                      ← COMMITTED to git (public EXPO_PUBLIC_* vars only)
├── .env.production           ← GITIGNORED (production API URL)
└── android/
    ├── local.properties      ← GITIGNORED (Maps API key + keystore config)
    ├── gradle.properties     ← COMMITTED (non-secret Gradle settings)
    └── app/
        ├── build.gradle      ← COMMITTED (reads from local.properties)
        └── src/main/
            └── AndroidManifest.xml  ← COMMITTED (uses ${googleMapsApiKey} placeholder)

~/prayana-release.keystore    ← NEVER in repo — stored in password manager + backup
```

---

## CI/CD with GitHub Actions

For automated builds (recommended before scaling the team), store these in **GitHub → Settings → Secrets and variables → Actions:**

| GitHub Secret Name | Value |
|---|---|
| `GOOGLE_MAPS_API_KEY` | The Maps API key |
| `RELEASE_KEYSTORE_BASE64` | Run: `base64 ~/prayana-release.keystore \| pbcopy` |
| `RELEASE_STORE_PASSWORD` | Your keystore password |
| `RELEASE_KEY_PASSWORD` | Your key password |

**Sample workflow** — create `.github/workflows/android-release.yml` in `prayana-mobile`:

```yaml
name: Android Release Build
on:
  push:
    tags:
      - 'v*'   # triggers on version tags like v1.0.0

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Decode keystore from base64
        run: echo "${{ secrets.RELEASE_KEYSTORE_BASE64 }}" | base64 -d > ~/prayana-release.keystore

      - name: Create local.properties
        run: |
          echo "sdk.dir=$ANDROID_SDK_ROOT" > apps/customer/android/local.properties
          echo "GOOGLE_MAPS_API_KEY=${{ secrets.GOOGLE_MAPS_API_KEY }}" >> apps/customer/android/local.properties
          echo "RELEASE_STORE_FILE=$HOME/prayana-release.keystore" >> apps/customer/android/local.properties
          echo "RELEASE_STORE_PASSWORD=${{ secrets.RELEASE_STORE_PASSWORD }}" >> apps/customer/android/local.properties
          echo "RELEASE_KEY_ALIAS=prayana" >> apps/customer/android/local.properties
          echo "RELEASE_KEY_PASSWORD=${{ secrets.RELEASE_KEY_PASSWORD }}" >> apps/customer/android/local.properties

      - name: Build release AAB
        run: cd apps/customer/android && ./gradlew bundleRelease

      - name: Upload AAB artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release
          path: apps/customer/android/app/build/outputs/bundle/release/app-release.aab
```

To trigger a release build: `git tag v1.0.0 && git push origin v1.0.0`

---

## Quick Reference Checklist

### One-Time Setup
- [ ] `local.properties` updated with Maps API key and keystore config
- [ ] `build.gradle` reads `local.properties` via `manifestPlaceholders`
- [ ] `AndroidManifest.xml` uses `${googleMapsApiKey}` placeholder (no hardcoded key)
- [ ] Release keystore generated at `~/prayana-release.keystore`
- [ ] Keystore + all passwords saved in password manager
- [ ] Keystore file backed up securely (USB drive, encrypted cloud storage)
- [ ] Release SHA-1 added to Google Cloud Console → Android Maps API key
- [ ] Release SHA-1 added to Google Cloud Console → Android OAuth client
- [ ] `.env.production` created with production API URL
- [ ] `.env.production` and `local.properties` are in `.gitignore`

### Each Release
- [ ] Update version code and version name in `build.gradle`
- [ ] Run `./gradlew bundleRelease` — build succeeds without errors
- [ ] Test the release AAB on internal testing track before promoting
- [ ] Google Sign-In works on a physical device (not emulator)
- [ ] Map loads correctly in the release build
- [ ] API calls reach the production backend (not 192.168.x.x)
- [ ] Upload AAB to Play Console → promote through internal → closed → open testing → production

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` is empty in build | `local.properties` missing or wrong key name | Check spelling — must match exactly |
| Map not loading in release build | SHA-1 not registered in Google Cloud Console | Add release SHA-1 to the Android Maps key |
| Google Sign-In blocked in release build | SHA-1 not registered in Android OAuth client | Add release SHA-1 to Android OAuth 2.0 client |
| `./gradlew bundleRelease` fails with signing error | Keystore path wrong or file missing | Check `RELEASE_STORE_FILE` path in `local.properties` |
| Can't update app on Play Store | Wrong or missing keystore | Always keep a backup — no recovery is possible |

---

*Document: Prayana AI — Android Secrets Management & Play Store Deployment*
*App Package: `com.prayanaai.customer` | Platform: Android (Expo + React Native)*
