#!/usr/bin/env sh
# Build the latest Android release APK the way Play already trusts.
#
# OWNER 25 Nov ("app build latest wala do"). The signing keystore and its password live in
# android/app (try1second-release.keystore, build.gradle.kts), so any machine with Flutter
# reproduces the SAME signature Play accepts - nothing to configure first.
#
#   ./build_apk.sh
#
# Output: Try1Second-v<version>-apk.apk in this folder, ready to install on a phone.
set -eu
cd "$(dirname "$0")"

RAW="$(sed -n 's/^version:[[:space:]]*//p' pubspec.yaml | head -1 | tr -d '\r')"
VERSION="$(printf '%s' "$RAW" | cut -d+ -f1)"
CODE="$(printf '%s' "$RAW" | cut -d+ -f2)"

if [ -z "$VERSION" ]; then
  echo "Could not read the version from pubspec.yaml" >&2
  exit 1
fi

echo "==> Try1Second v$VERSION+$CODE"
command -v flutter >/dev/null 2>&1 || {
  echo "flutter is not on PATH - install Flutter (>= 3.22) and run this again." >&2
  exit 1
}

flutter pub get
flutter build apk --release

OUT="Try1Second-v$VERSION-apk.apk"
cp build/app/outputs/flutter-apk/app-release.apk "$OUT"
echo "==> Built $(pwd)/$OUT"
echo "    Install it on the phone, or upload it to Play Console as the $CODE build."
