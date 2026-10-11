#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$REPO_ROOT/apps/android/android"
GRADLEW="$ANDROID_DIR/gradlew"

if [[ ! -f "$GRADLEW" ]]; then
    echo "FAILURE: Gradle wrapper not found at $GRADLEW"
    exit 1
fi

echo "==> 1. Verifying assembleRelease fails without credentials..."
set +e
RELEASE_OUT="$(env -u STORE_FILE -u KEY_ALIAS -u STORE_PASSWORD -u KEY_PASSWORD \
    bash "$GRADLEW" -p "$ANDROID_DIR" -P e6.ignoreReleaseSigningCredentials=true assembleRelease 2>&1)"
RELEASE_EXIT=$?
set -e

if [[ $RELEASE_EXIT -eq 0 ]]; then
    echo "FAILURE: assembleRelease unexpectedly succeeded without credentials!"
    exit 1
fi

EXPECTED="Release build failed: Missing required release signing credentials: storeFile (key.properties: storeFile or STORE_FILE), keyAlias (key.properties: keyAlias or KEY_ALIAS), storePassword (key.properties: storePassword or STORE_PASSWORD), keyPassword (key.properties: keyPassword or KEY_PASSWORD)."
if [[ "$RELEASE_OUT" == *"$EXPECTED"* ]]; then
    echo "SUCCESS: assembleRelease failed with the expected missing-credentials diagnostic."
else
    echo "FAILURE: assembleRelease failed without the expected diagnostic."
    printf '%s\n' "$RELEASE_OUT"
    exit 1
fi

echo "==> 2. Verifying assembleDebug succeeds with debug signing..."
bash "$GRADLEW" -p "$ANDROID_DIR" assembleDebug

echo "All Android signing build checks passed!"
