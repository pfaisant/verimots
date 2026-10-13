# Verimots source synchronization — 13 October 2026

Published: web and Android **5.1.1 / versionCode 89** (9 October 2026).
This sync does not publish an APK, a Play release or a web deployment.

## Why

After 5 October, every release (5.0.1, 5.0.2, 5.1.0 Révisions, 5.1.1) was
built and deployed from the AiConglomerate mirrors, not from this repository.
This repository stopped at 5.0.0 plus work that was never deployed.

Imported from pfaisant/AiConglomerate `fd96677f` (origin/main, 13 Oct 2026),
which is also what s.hackdict.com serves. Mappings are the usual ones:
dashboard/s -> web, dashboard/verimots -> landing, android/ods9 -> android,
plus scripts/ods-game.mjs, ods-define.mjs and http-safety.mjs.

## How

Each file was classified against the full AiConglomerate history:

- 212 identical; 37 changed only in AiConglomerate (copied as is);
  43 new there (Révisions, diagnostics, board_v5 strings, site-status.js…).
- 26 changed on both sides. Each was merged three-way, with the newest
  version both repositories had ever contained as the base. 13 had conflicts.
  The conflicts were cache-busting `?v=` strings, the leaderboard filters and
  the joker's `tileAssignments(tiles, word, picks)`, which AiConglomerate
  exports for Révisions.
- Lexicon assets under android/app/src/main/assets/data stay here; the
  mirror does not track them.
- The stray nested android/ods9/ods9 copy in AiConglomerate was not imported.

Tests were brought across with the same path rewrite as on 21 September
(`../dashboard/s/` -> `../web/`), merged the same way, plus ods-players and
ods-reviews. Test imports now pin `?v=162`, like the web modules.

## What this repository has that was never published

- The **joker picker** (docs/joker-picker.md), web and Android. Neither
  the published 5.0.0 nor anything after it contains it. It now sits on top of
  5.1.1. The browser smoke test passes: tap a blank, pick a letter, and
  ARSENIC on A??EINS scores 55.
- Android source still says 5.1.1 / 89. The next upload with the picker
  needs a new versionCode.

The leaderboard work from 21 September (rolling 7/30 days and a language
filter) is not on that list. AiConglomerate shipped its own superset (3 days,
saved filters), and that version is kept.

## Two 5.0.0 notes

AiConglomerate published 5.0.0 (code 85) on 23 September from the Mac, without
the picker. That record, with its hashes, is now docs/verimots-5.0.0.md. The
5 October note written here for a Windows 5.0.0 build with the picker is kept
as docs/verimots-5.0.0-joker-candidate.md.

## Fixes made during the sync

- scripts/ods-game.mjs imported `../dashboard/s/review-core.js`, so it failed
  to load from this layout. It now looks in web/ and then dashboard/s/, like
  kids.js and tiles.js.
- scripts/serve.mjs isolated every state file except the two that 5.1.0 added
  (`ODS9_REVIEWS_DIR`, `ODS9_PLAYERS_FILE`). A local server on the host machine
  would have written to the live `~/.local/state/aiconglomerate` files. Both
  now go to `.local-state/`.

## Google sign-in origins

The web client `617674779621-vu2…` (project curiousminds-511219) accepts
sign-in only from its listed JavaScript origins. Since the move to hackdict
(11 October), s.pfa87.cc redirects to s.hackdict.com. s.hackdict.com was
never added to that list, so sign-in failed with `Error 400: origin_mismatch`.
Any new host serving web/ must be added there. Check a host with:

    curl -s -o /dev/null -w '%{http_code}\n' -H 'Referer: https://<host>/' \
      'https://accounts.google.com/gsi/button?client_id=<id>&iframe_id=x&as=x'

200 means the origin is allowed and 403 means it is not.

Checks: `npm test` 265/265.
