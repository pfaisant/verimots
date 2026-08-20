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
  echo "missing keystore $KS — refusing to genkeypair" >&2
  exit 1
fi
DATA="$APP/app/src/main/assets/data"
mkdir -p "$DATA"
rm -rf "$APP/app/src/main/assets/www"
cp -f "$ROOT/web/data/ods9.txt.gz" "$DATA/ods9.txt.gz"
cp -f "$ROOT/web/data/yawl.txt.gz" "$DATA/yawl.txt.gz"
cp -f "$ROOT/web/data/rla-es.txt.gz" "$DATA/rla-es.txt.gz"
cp -f "$ROOT/web/data/meta-en.json" "$DATA/meta-en.json"
cp -f "$ROOT/web/data/meta-es.json" "$DATA/meta-es.json"
cp -f "$ROOT/web/data/meta.json" "$DATA/meta.json"
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
  cp -f "$AAB" "$DEST/verimots-${VERSION}-${CODE}.aab"
  echo "wrote $DEST/verimots.apk, $DEST/verimots-${VERSION}.apk ($(wc -c < "$DEST/verimots.apk") bytes) and $DEST/verimots-${VERSION}-${CODE}.aab"
else
  echo "wrote $DEST/verimots.apk and $DEST/verimots-${VERSION}.apk ($(wc -c < "$DEST/verimots.apk") bytes) — no AAB"
fi
