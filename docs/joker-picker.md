# Joker tile picker — integrated 21 September 2026

Tapping a blank opens a legal-letter picker on the web and Android. The
chosen letter appears on a blank only when the word needs that blank;
available real letters are used first, matching the existing score solver.
This corrects the original experiment, which could show a zero-point blank
while the solver awarded points for a real letter. The picker explains the
rule. No score API or ranked scoring rule changes.

- Supports French, English, both Spanish tile sets and Catalan, including
  digraphs, Ç, NY, QU and L·L. FISE excludes K/W; Catalan excludes K/W/Y/Q.
- A blank can be edited or cleared. Its displayed point value stays zero.
- Web supports arrows, Escape with focus return, and outside-click dismissal.
  The scrollable grid fits narrow phones and retains 44px minimum targets.
- Native targets are 48dp; dialog actions reject a changed or closed round.
- Shared web racks preserve question-mark blanks. New deals clear choices.
- Existing 4.8 fonts, account/session protections and analytics consent remain.
- Web shell/module cache version is 161. Source remains the unpublished
  4.8.1 candidate; public APK manifest remains 4.8.0. Existing candidate
  APKs built on September 18 do not contain this later source change.

Validation:
- npm test (245 cases).
- npm run test:joker:browser: 12 scenarios across four languages and
  320/390/1280px; choices, keyboard navigation, editing, clearing, real-tile
  priority, multiple blanks, and overflow; screenshots visually checked.
- npm run test:browser: 19 existing release/offline checks.
- Mac Android assembleDebug and lintDebug: success, 0 errors / 190 warnings.
  No connected Android device was available for native interaction testing.

All Windows evidence is in .local/. No APK was published or installed on a
user device. The original experiment is retained in the merge ancestry.
