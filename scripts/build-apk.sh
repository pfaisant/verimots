#!/usr/bin/env bash
# Build the signed Verimots Android APK and copy it to dashboard/s/
set -euo pipefail
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:${PATH:-}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/android"
KS="$HOME/.config/aiconglomerate/ods9.keystore"
if [[ ! -f "$KS" ]]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -alias ods9 -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "${ODS9_KEYSTORE_PASS:-ods9pfa87}" -keypass "${ODS9_KEY_PASS:-ods9pfa87}" \
    -dname "CN=ODS9, OU=pfa87, O=pfa87, L=Paris, C=FR"
  chmod 600 "$KS"
fi
DATA="$APP/app/src/main/assets/data"
mkdir -p "$DATA"
rm -rf "$APP/app/src/main/assets/www"
cp -f "$ROOT/web/data/ods9.txt.gz" "$DATA/ods9.txt.gz"
cd "$APP"
./gradlew assembleRelease bundleRelease --offline --quiet || ./gradlew assembleRelease bundleRelease
OUT="$APP/app/build/outputs/apk/release/app-release.apk"
AAB="$APP/app/build/outputs/bundle/release/app-release.aab"
VERSION="$(sed -n 's/.*versionName "\([^"]*\)".*/\1/p' "$APP/app/build.gradle" | head -1)"
CODE="$(sed -n 's/.*versionCode \([0-9][0-9]*\).*/\1/p' "$APP/app/build.gradle" | head -1)"
VERSION="${VERSION:-0}"
CODE="${CODE:-0}"
DEST="$ROOT/web"
cp -f "$OUT" "$DEST/verimots.apk"
cp -f "$OUT" "$DEST/verimots-${VERSION}.apk"
cp -f "$OUT" "$DEST/ods9.apk"
BUILT="$(date '+%Y-%m-%d %H:%M')"
cat > "$DEST/apk.json" <<EOF
{
  "version": "${VERSION}",
  "versionCode": ${CODE},
  "href": "verimots.apk",
  "versioned": "verimots-${VERSION}.apk",
  "builtAt": "${BUILT}"
}
EOF
if [[ -f "$AAB" ]]; then
  cp -f "$AAB" "$DEST/verimots-${VERSION}.aab"
  echo "wrote $DEST/verimots.apk, $DEST/verimots-${VERSION}.apk ($(wc -c < "$DEST/verimots.apk") bytes) and $DEST/verimots-${VERSION}.aab"
else
  echo "wrote $DEST/verimots.apk and $DEST/verimots-${VERSION}.apk ($(wc -c < "$DEST/verimots.apk") bytes) — no AAB"
fi
