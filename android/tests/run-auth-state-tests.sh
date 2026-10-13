#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/verimots-auth-tests.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT
javac -d "$BUILD_DIR" "$ROOT/app/src/main/java/cc/pfa87/ods9/BrowserAuthState.java" "$ROOT/tests/BrowserAuthStateTest.java"
java -cp "$BUILD_DIR" cc.pfa87.ods9.BrowserAuthStateTest
javac -d "$BUILD_DIR" "$ROOT/app/src/main/java/cc/pfa87/ods9/AuthDiag.java" "$ROOT/tests/AuthDiagTest.java"
java -cp "$BUILD_DIR" cc.pfa87.ods9.AuthDiagTest
javac -d "$BUILD_DIR" "$ROOT/app/src/main/java/cc/pfa87/ods9/ReviewRules.java" "$ROOT/tests/ReviewRulesTest.java"
java -cp "$BUILD_DIR" cc.pfa87.ods9.ReviewRulesTest
