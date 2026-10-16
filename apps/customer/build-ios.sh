#!/bin/bash
# EAS iOS build using App Store Connect API key (no Apple password/2FA).
# Interactive so EAS can regenerate the provisioning profile with the required
# capabilities (Associated Domains + Push) — the API key auto-authenticates.
cd "$(dirname "$0")"
# The key lives in the repo-root keystores/ folder (git-ignored).
KEYDIR="$(cd ../.. && pwd)/keystores"
export EXPO_ASC_API_KEY_PATH="$KEYDIR/AuthKey_XA4NW9YBX9.p8"
export EXPO_ASC_API_KEY_ID="XA4NW9YBX9"
export EXPO_ASC_API_KEY_ISSUER_ID="f23038f7-4b3d-4eb3-b45b-d13e18ad8858"
export EXPO_APPLE_APP_STORE_CONNECT_API_KEY_PATH="$KEYDIR/AuthKey_XA4NW9YBX9.p8"
export EXPO_APPLE_APP_STORE_CONNECT_API_KEY_ID="XA4NW9YBX9"
export EXPO_APPLE_APP_STORE_CONNECT_API_KEY_ISSUER_ID="f23038f7-4b3d-4eb3-b45b-d13e18ad8858"
export EAS_BUILD_NO_EXPO_GO_WARNING=true
# Interactive (no --non-interactive) so it can sync capabilities to the profile.
npx eas-cli@latest build --platform ios --profile production
