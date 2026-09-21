# Verimots 4.8.0 — consistent lettering and quieter definitions

Published 17 September 2026, Android versionCode 83. The existing
`cc.pfa87.verimots` package and Play upload signer are preserved.

- The landing page, web app, favicon and Android launcher/header share the
  cream V tile and green checkmark. The V is now the outline of the same
  bundled font used for game, checker and study tiles, including point values.
- Verimots Tiles is a renamed, OFL-licensed subset of Liberation Sans Regular:
  a classic printed tile approximation with flat terminals. It is not a copy
  of a proprietary Scrabble font. `assets/verimots/README.md` documents the
  source; `uv run scripts/build-verimots-brand.py` regenerates every variant.
- Decorative gold labels become muted sentence-case text. The checker uses
  “Mot du jour” or “Un mot au hasard”, translated in all four languages.
  Native definitions omit redundant “Voir…” controls when the word is
  already linked in the text, with a plain word link retained when needed.
  Definition links and return navigation remain available.
- Web modules and the offline shell share cache version 160, including the
  local font. Landing assets use version 43. No service restart was needed.

## Validation

- Shared-browser checks: checker, definition navigation and return, daily
  word/shuffle, game rack and landing page. The app has no horizontal page
  overflow at 1280, 390 or 320 CSS pixels. The dashboard overview and Verimots
  modal also fit at 1280×800 without horizontal page/dialog overflow.
- Android release APK, AAB and lint build successfully: 0 errors, 186 warnings.
  Android 36 emulator checks cover DEMANDES, MANGEZ → manger, PAINS → pain,
  daily-word shuffle, tile taps, answer submission, result-word selection and
  the next offline draw. Fresh 320 dp layouts show all seven rack tiles.
  Changing emulator width while a rack was already populated exposed existing
  stale tile sizing; relaunching fits correctly. Dynamic native window resize
  is not claimed fixed. No physical-phone test was performed.
- 133/134 existing Verimots/tile tests pass. The remaining dictionary-copy
  assertion expects “SCRABBLE is a trademark” in `about_p3`; the same mismatch
  is present in HEAD before this change.
- Generator and server syntax checks, dashboard build and selfcheck pass
  (7 existing machine-path warnings). Global verification passes 149/153:
  the failures concern unwatched tunnel ports 4321/8109, old Stripe and X
  snapshots, and the existing paid-product public-surface check.
- Font/icon generation is byte-reproducible; web/Android glyph coverage,
  matching icon PNGs, XML, syntax, scoped whitespace checks and the 31-import
  web module graph pass.

Web evidence: `_agent_work/verimots-design-20260917/`.
Native build logs and screenshots: `_agent_work/verimots-native-4.8.0-20260917/`.

## Artifacts

Published with `scripts/build-ods9-apk.sh --publish-built`, preserving the
exact tested APK and AAB and all immutable historical releases.

- APK: https://downloads.pfa87.cc/verimots-4.8.0.apk (5,751,787 bytes).
- AAB: https://downloads.pfa87.cc/verimots-4.8.0-83.aab (5,861,129 bytes).
- APK SHA-256: `c01e52626fb31d4e490852f9d6a699de7d38a70043fe2e26787a383ebb8c9ef3`.
- AAB SHA-256: `d225293ad09afc58307baaace948e242b623aa01929c85119feddc4c5f830b33`.

The public downloads catalogue and full APK/AAB downloads were verified
against the release manifest. Google Play upload is separate from this
download release.
