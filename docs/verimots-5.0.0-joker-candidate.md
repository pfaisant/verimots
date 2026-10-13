# Verimots Android 5.0.0 — Play production update after public launch

**Android 5.0.0 / versionCode 85**, package `cc.pfa87.verimots`. Succeeds
public Play production **4.8.1 (84)** (live from ~5 Oct 2026). First Play
Store update after the initial public listing cleared review.

## Included relative to 4.8.1 candidate lineage

- Browser sign-in harding from 4.8.1 (`ACTION_VIEW` + `CATEGORY_BROWSABLE`,
  update prompts, package-restricted handoff).
- Reviewed [joker picker](joker-picker.md) (tap blank → legal letter; scoring
  parity; FR/EN/ES/CA including digraphs). Earlier Sep-18-only 4.8.1 artifacts
  did not contain the picker; confirm the uploaded AAB includes it.
- Existing offline lexicons, training modes, competitive Google sign-in gate
  (still no live Google button ship until Paul provides Web Client ID).

## Process line

- Version bump in `android/app/build.gradle`: 4.8.1 (84) → 5.0.0 (85).
- Web/unit suite: run `npm test` on this branch before merge.
- Signed AAB: Mac mini with `~/.config/aiconglomerate/ods9.keystore` (Play
  upload SHA1 `60:14:D1:85:5A:98:EB:CF:09:1A:BA:BB:1A:5B:FD:08:09:55:69:D2`)
  via `scripts/build-apk.sh --build-only` (or full publish when asked).
- Do **not** claim Play live until Console production shows ≥5.0.0.

## Checklist

- [x] versionName 5.0.0 / versionCode 85
- [x] npm test (250 pass, 2026-10-05 Windows)
- [ ] lintRelease + signed bundleRelease (Mini keystore)
- [ ] Play Console production upload / review
- [ ] Public listing shows 5.x
