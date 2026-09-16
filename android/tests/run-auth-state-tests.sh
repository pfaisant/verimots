#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/verimots-auth-tests.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT
javac -d "$BUILD_DIR" "$ROOT/app/src/main/java/cc/pfa87/ods9/BrowserAuthState.java" "$ROOT/tests/BrowserAuthStateTest.java"
java -cp "$BUILD_DIR" cc.pfa87.ods9.BrowserAuthStateTest
