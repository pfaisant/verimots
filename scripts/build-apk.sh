#!/usr/bin/env bash
# Build and verify signed Verimots APK/AAB files, then publish to web/.
# --publish-built verifies and publishes the existing tested artifacts unchanged.
set -euo pipefail
PUBLISH_BUILT=0
BUILD_ONLY=0
if [[ $# -gt 1 ]]; then
  echo "usage: $0 [--build-only | --publish-built]" >&2
  exit 2
fi
case "${1:-}" in
  "") ;;
  --publish-built) PUBLISH_BUILT=1 ;;
  --build-only) BUILD_ONLY=1 ;;
  --help|-h) echo "usage: $0 [--build-only | --publish-built]"; exit 0 ;;
  *) echo "usage: $0 [--build-only | --publish-built]" >&2; exit 2 ;;
esac
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:${PATH:-}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/android"
KS="$HOME/.config/aiconglomerate/ods9.keystore"
PLAY_SHA1="60:14:D1:85:5A:98:EB:CF:09:1A:BA:BB:1A:5B:FD:08:09:55:69:D2"
if [[ ! -f "$KS" ]]; then
  echo "missing keystore $KS — refusing to genkeypair" >&2
  exit 1
fi
KS_SHA1="$(keytool -list -v -keystore "$KS" -alias ods9 -storepass "${ODS9_KEYSTORE_PASS:-ods9pfa87}" 2>/dev/null | awk '/SHA1:/{print $2; exit}')"
if [[ "$KS_SHA1" != "$PLAY_SHA1" ]]; then
  echo "keystore $KS SHA1 ${KS_SHA1:-?} is not the Play upload key $PLAY_SHA1" >&2
  echo "move the wrong file aside; do not genkeypair" >&2
  exit 1
fi
if [[ "$PUBLISH_BUILT" == "0" ]]; then
  DATA="$APP/app/src/main/assets/data"
  mkdir -p "$DATA"
  rm -rf "$APP/app/src/main/assets/www"
  cp -f "$ROOT/web/data/ods9.txt.gz" "$DATA/ods9.txt.gz"
  cp -f "$ROOT/web/data/yawl.txt.gz" "$DATA/yawl.txt.gz"
  cp -f "$ROOT/web/data/wow24.txt.gz" "$DATA/wow24.txt.gz"
  cp -f "$ROOT/web/data/rla-es.txt.gz" "$DATA/rla-es.txt.gz"
  cp -f "$ROOT/web/data/disc-ca.txt.gz" "$DATA/disc-ca.txt.gz"
  cp -f "$ROOT/web/data/meta-ca.json" "$DATA/meta-ca.json"
  cp -f "$ROOT/web/data/meta-en.json" "$DATA/meta-en.json"
  cp -f "$ROOT/web/data/meta-en-wow24.json" "$DATA/meta-en-wow24.json"
  cp -f "$ROOT/web/data/meta-es.json" "$DATA/meta-es.json"
  cp -f "$ROOT/web/data/meta.json" "$DATA/meta.json"
  cd "$APP"
  ./gradlew clean lintRelease assembleRelease bundleRelease --offline --quiet || ./gradlew clean lintRelease assembleRelease bundleRelease
fi
OUT="$APP/app/build/outputs/apk/release/app-release.apk"
AAB="$APP/app/build/outputs/bundle/release/app-release.aab"
VERSION="$(sed -n 's/.*versionName "\([^"]*\)".*/\1/p' "$APP/app/build.gradle" | head -1)"
CODE="$(sed -n 's/.*versionCode \([0-9][0-9]*\).*/\1/p' "$APP/app/build.gradle" | head -1)"
if [[ ! "$VERSION" =~ ^[0-9]+(\.[0-9]+)*([.-][A-Za-z0-9]+)*$ || ! "$CODE" =~ ^[1-9][0-9]*$ ]]; then
  echo "missing or invalid Android version — not publishing" >&2
  exit 1
fi
if [[ ! -s "$OUT" || ! -s "$AAB" ]]; then
  echo "both the release APK and AAB must exist and be nonempty — not publishing" >&2
  exit 1
fi
if [[ "$PUBLISH_BUILT" == "1" ]]; then
  # Check both outputs: assembling only the APK must not publish an older AAB.
  # Source directory timestamps also catch a file deleted after the build.
  STALE_SOURCES="$(find "$APP/app/src" "$APP/app/build.gradle" \
    "$APP/app/proguard-rules.pro" "$APP/build.gradle" "$APP/settings.gradle" \
    "$APP/gradle.properties" "$APP/gradle" "$APP/gradlew" \
    \( -newer "$OUT" -o -newer "$AAB" \) -print)"
  if [[ -n "$STALE_SOURCES" ]]; then
    printf 'Android sources changed after a release artifact was built — rebuild and test before publishing:\n%s\n' "$STALE_SOURCES" >&2
    exit 1
  fi
fi

APKSIGNER="$(printf '%s\n' "$ANDROID_HOME"/build-tools/*/apksigner | sort -V | tail -1)"
AAPT="$(dirname "$APKSIGNER")/aapt"
if [[ ! -x "$APKSIGNER" || ! -x "$AAPT" ]]; then
  echo "Android build-tools apksigner and aapt are required — not publishing" >&2
  exit 1
fi

DEST="$ROOT/web"
mkdir -p "$DEST"
# Stage on the same filesystem: each final rename is atomic, and the public
# metadata changes only after every referenced artifact is fully in place.
if [[ "$BUILD_ONLY" == "1" ]]; then
  STAGE="$(mktemp -d "${TMPDIR:-/tmp}/verimots-release.XXXXXX")"
else
  STAGE="$(mktemp -d "$DEST/.verimots-release.XXXXXX")"
fi
trap 'rm -rf "$STAGE"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
APK_NAME="verimots-${VERSION}.apk"
AAB_NAME="verimots-${VERSION}-${CODE}.aab"
cp "$OUT" "$STAGE/$APK_NAME"
cp "$AAB" "$STAGE/$AAB_NAME"

APK_VERIFY="$("$APKSIGNER" verify --verbose --print-certs "$STAGE/$APK_NAME")"
APK_SHA1="$(printf '%s\n' "$APK_VERIFY" | awk '/^Signer #1 certificate SHA-1 digest:/ {print $NF; exit}' | tr '[:lower:]' '[:upper:]')"
APK_SIGNER_SHA256="$(printf '%s\n' "$APK_VERIFY" | awk '/^Signer #1 certificate SHA-256 digest:/ {print $NF; exit}' | tr '[:upper:]' '[:lower:]')"
APK_SIGNERS="$(printf '%s\n' "$APK_VERIFY" | awk '/^Signer #[0-9]+ certificate SHA-1 digest:/ {n++} END {print n+0}')"
if [[ "$APK_SHA1" != "${PLAY_SHA1//:/}" || "$APK_SIGNERS" != "1" || ! "$APK_SIGNER_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "APK signer is not the single expected Play upload key $PLAY_SHA1 — not publishing" >&2
  exit 1
fi
BADGING="$("$AAPT" dump badging "$STAGE/$APK_NAME")"
if ! printf '%s\n' "$BADGING" | awk -v version="$VERSION" -v code="$CODE" '
  /^package:/ {
    found = index($0, "name=\047cc.pfa87.verimots\047") &&
      index($0, "versionCode=\047" code "\047") &&
      index($0, "versionName=\047" version "\047")
  }
  END {exit !found}
'; then
  echo "APK package/version does not match build.gradle — not publishing" >&2
  exit 1
fi
PACKAGE_NAME="$(printf '%s\n' "$BADGING" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
MIN_SDK="$(printf '%s\n' "$BADGING" | sed -n "s/^sdkVersion:'\([0-9][0-9]*\)'$/\1/p")"
if [[ ! "$MIN_SDK" =~ ^[1-9][0-9]*$ ]]; then
  echo "APK minimum SDK is missing or invalid — not publishing" >&2
  exit 1
fi

# A matching certificate alone does not prove bundle integrity. Strict JAR
# verification checks every signed entry against the trusted existing key.
if ! jarsigner -verify -strict -keystore "$KS" -storepass "${ODS9_KEYSTORE_PASS:-ods9pfa87}" "$STAGE/$AAB_NAME" ods9 > "$STAGE/aab-verification.log" 2>&1; then
  cat "$STAGE/aab-verification.log" >&2
  echo "AAB signature verification failed — not publishing" >&2
  exit 1
fi
AAB_SHA1="$(keytool -printcert -jarfile "$STAGE/$AAB_NAME" 2>/dev/null | awk '/SHA1:/{print $2; exit}')"
if [[ "$AAB_SHA1" != "$PLAY_SHA1" ]]; then
  echo "AAB signer ${AAB_SHA1:-?} is not the Play upload key $PLAY_SHA1 — not publishing" >&2
  exit 1
fi
if ! unzip -Z1 "$STAGE/$AAB_NAME" | awk '$0 == "base/manifest/AndroidManifest.xml" {found=1} END {exit !found}'; then
  echo "AAB has no base Android manifest — not publishing" >&2
  exit 1
fi

if [[ "$BUILD_ONLY" == "1" ]]; then
  echo "validated Verimots $VERSION ($CODE): $OUT and $AAB; nothing published"
  exit 0
fi

APK_SHA256="$(shasum -a 256 "$STAGE/$APK_NAME" | awk '{print $1}')"
AAB_SHA256="$(shasum -a 256 "$STAGE/$AAB_NAME" | awk '{print $1}')"
APK_BYTES="$(wc -c < "$STAGE/$APK_NAME" | tr -d '[:space:]')"
cp "$STAGE/$APK_NAME" "$STAGE/verimots.apk"
cp "$STAGE/$APK_NAME" "$STAGE/ods9.apk"
cp "$STAGE/$AAB_NAME" "$STAGE/verimots-${VERSION}.aab"
cp "$STAGE/$AAB_NAME" "$STAGE/verimots.aab"
# Published versioned filenames are immutable, including the version-only AAB.
# Verify every historical destination before replacing any current alias.
for artifact in "$APK_NAME" "$AAB_NAME" "verimots-${VERSION}.aab"; do
  if [[ -e "$DEST/$artifact" ]] && ! cmp -s "$STAGE/$artifact" "$DEST/$artifact"; then
    echo "$artifact already exists with different bytes — bump the release version before publishing" >&2
    exit 1
  fi
done
BUILT="$(TZ=Europe/London date '+%Y-%m-%d %H:%M')"
PUBLISHED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
cat > "$STAGE/apk.json" <<EOF
{
  "version": "${VERSION}",
  "versionCode": ${CODE},
  "packageName": "${PACKAGE_NAME}",
  "bytes": ${APK_BYTES},
  "minSdk": ${MIN_SDK},
  "href": "verimots.apk",
  "versioned": "${APK_NAME}",
  "aab": "${AAB_NAME}",
  "aabLatest": "verimots.aab",
  "builtAt": "${BUILT}",
  "publishedAt": "${PUBLISHED_AT}",
  "signerSha1": "${PLAY_SHA1}",
  "signerSha256": "${APK_SIGNER_SHA256}",
  "apkSha256": "${APK_SHA256}",
  "aabSha256": "${AAB_SHA256}"
}
EOF
for artifact in "$APK_NAME" "$AAB_NAME" "verimots-${VERSION}.aab"; do
  if [[ ! -e "$DEST/$artifact" ]]; then
    mv "$STAGE/$artifact" "$DEST/$artifact"
  fi
done
for artifact in verimots.apk ods9.apk verimots.aab; do
  mv -f "$STAGE/$artifact" "$DEST/$artifact"
done
mv -f "$STAGE/apk.json" "$DEST/apk.json"
echo "published Verimots $VERSION ($CODE): $DEST/$APK_NAME and $DEST/$AAB_NAME; APK/AAB signer verified as $PLAY_SHA1"
