# Verimots 5.0.1 (code 86) — 23 Sep 2026

Polish of the APK game result, from a phone screenshot of the 5.0.0 Bingo screen.

- Definition links read as text again. Every gloss word ≥ 4 letters had a full-strength
  underline; `DefTextView` now draws the web's `button.form-of` rule instead: faint dotted
  (muted at 32 %) under gloss words, faint solid under an inflection's root. Used by the
  Bingo/Trouver result, Vérifier, Petits Mots and Combinaisons definition bodies.
- A collapsed definition never ends on the next sense's `WORD · nom` header (or the blank
  line before it); the preview stops at the last line of real text.
- Rack card: the 14 dp below the tiles belonged to the hidden answer field; it now sits on
  the field, so the result rack has even padding. 10 dp gap between the rack and score cards.
- The game scroll fades at its edges instead of cutting the definition card flat.
- The dock shows the last score only beside a trend (≥ 2 scores); alone it repeated the
  result card's percentage.

Checks: `tests/run-auth-state-tests.sh` (11 passed), `lintRelease` (no new issues), release
APK on emulator-5590 (Trouver un mot result: AIKIDO dotted links, tap → MARTIAL, EMIGRE
preview trimmed before the verb header). Published via `scripts/build-ods9-apk.sh`;
`downloads.pfa87.cc/releases.json` lists 5.0.1/86 and the downloaded APK hash matches
`3c431193…4b91`. Not checked on a physical phone.
