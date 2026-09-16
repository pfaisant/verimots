# Verimots

Offline French, English, Spanish and Catalan word checker, rack search and
letter challenge.
Web at [s.pfa87.cc](https://s.pfa87.cc/) and native Android (`cc.pfa87.verimots`).

The bundled word lists are community-maintained. Verimots is not Larousse, Mattel, WGPO or any federation.

English has two lists in Settings: a community list following CSW (YAWL, the closest public-domain match — not official Collins) and WGPO Official Words 2024 (WOW24). Official CSW is HarperCollins copyright and is not bundled. New English sessions default to WOW24.

## Layout

- `web/` — static site (check, tiroir, défi, privacy)
- `landing/` - product page, also available locally at `/welcome/`
- `android/` — native app (Gradle)
- `scripts/` — define proxy, game/auth API, APK build
- `tests/` — Node tests

## Run the site locally

```sh
npm ci
npm test
npm start
```

Opens `http://127.0.0.1:4174`. API data and session secrets are isolated in
the ignored `.local-state/` directory. Definitions still contact Wiktionary.
Google sign-in needs an authorized OAuth origin. To test feedback or signup,
set `MAIL_RELAY_URL=http://127.0.0.1:1` so local tests cannot send mail.

With the local server running, `npm run test:browser` checks all four languages,
mobile/desktop layouts and an offline reload in an isolated Chrome profile.
Set `BROWSER_PATH` if Chrome/Chromium is not installed in a standard location;
set `SCREENSHOT_DIR` to save the reviewed screens.

## Source and Mac mini sync

This repository owns the web app, landing page, native app and their two API
modules. The Mac mini hosts them from `~/Dev/AiConglomerate`. Do not edit that
copy independently: doing so previously left source at web v142 / Android4.3.0
while deployment was web v157 / Android4.7.0.

Run tests first, then plan a sync from the source checkout on the Mac:

```sh
node scripts/sync-deployment.mjs --target ../AiConglomerate --plan /tmp/verimots-sync.json
# Inspect the plan before applying it. Use a fresh backup directory.
node scripts/sync-deployment.mjs --apply /tmp/verimots-sync.json --backup ../verimots-backups/release-4.7.1
```

The plan pins both source and destination hashes. Applying it refuses concurrent
edits, backs up changed files, and verifies copied files. It never deletes
unrelated files or copies credentials, state, build directories or APK/AAB files.
The multi-file update is not a filesystem transaction: if interrupted, consult
the backup plan and restore affected files before retrying. Restart the dashboard
host after backend changes; its shared `scripts/serve.mjs` is never overwritten.

The release review and remaining gates are in [RELEASE_REVIEW.md](RELEASE_REVIEW.md).

## Android

```sh
bash scripts/build-apk.sh --build-only
```

Needs a JDK 17, Android SDK, and the release keystore at `~/.config/aiconglomerate/ods9.keystore`.

`--build-only` builds and verifies signed APK/AAB candidates without changing public
download metadata. Candidate source is 4.7.1/code82; the published download stays
at 4.7.0 until a separately verified release is selected. No Play release is
submitted by this command.

Play package: `cc.pfa87.verimots`. Listing copy and icons are in `android/play/`.

## English lexicons

- CSW stand-in (YAWL): `node scripts/build-en-lexicon.mjs`
- WGPO WOW24: `node scripts/build-wow24-lexicon.mjs`

## Catalan lexicon

Catalan uses **DISC** (*Diccionari Informatitzat de l'Scrabble en Català*) by
Joan Montané, dual-licensed GPLv3 / CC-BY-SA 3.0 and already published in
Scrabble form. It is the only bundled list that *is* a real Scrabble
dictionary: Verimots redistributes it unchanged.

Catalan Scrabble has 100 tiles and three multi-character tiles — **NY**,
**QU** and **L·L** (ela geminada) — plus its own **Ç**. There is no K, W or Y
tile (Y only appears inside NY) and the Q tile is always played as QU, the
convention Catalan clubs and DISC follow. So `LL` is two L tiles (CAVALL) and
`L·L` is one (COL·LEGI); the rack input also accepts `Ŀ` and the tile digits
4/5/6, and the app shows an `L·L` key for keyboards without an interpunct.

Unlike Spanish there is no separator: no run of Catalan tiles re-encodes
ambiguously, and `·` belongs to the L·L tile itself. `tests/tiles.test.mjs`
proves that over every pair and triple of tiles.

Rebuild the list with:

```sh
python3 scripts/build-ca-lexicon.py            # download + rebuild list and meta
python3 scripts/build-ca-lexicon.py --meta-only # meta from the existing list
```

The club publishes a new DISC roughly once a year; the script pins the version
and SHA-256 and fails loudly when upstream moves.

## Spanish lexicon

Spanish uses the MPL-1.1 RLA-ES dictionary, stress marks removed, Ñ preserved.
Spanish Scrabble has digraph tiles and two official tile sets, both supported
(Settings → Spanish tile set):

- **International / FISE** (default, 100 tiles): CH, LL and RR are single tiles;
  there is no K or W and a blank may not stand for them (K/W words are shown as
  "in the list, unplayable").
- **North America** ("Edición en español", 103 tiles): K and W exist, LL and RR
  are tiles, but there is no CH tile.

Internally every word and rack is tile-encoded (`1` = CH, `2` = LL, `3` = RR — see
`web/tiles.js` and `android/.../Lexicon.java`), so lengths, joker positions and the
7-tile bingo bonus are tile-correct. In a rack, `L·L` (or `L L`) means two L tiles,
`LL` the digraph. The ranked weekly trail always uses the international set.

The word list is stored in plain orthography and filtered to 2–15 *tiles*; rebuild it with:

```sh
python3 -m pip install -r scripts/requirements-lexicon.txt
python3 scripts/build-es-lexicon.py            # download + rebuild list and meta
python3 scripts/build-es-lexicon.py --meta-only # per-edition meta from the existing list
```

See `THIRD_PARTY_NOTICES.md` for attribution and transformation details.

## Legal pages

- https://s.pfa87.cc/confidentialite.html
- https://s.pfa87.cc/privacy.html
- https://s.pfa87.cc/privacidad.html
- https://s.pfa87.cc/support.html
- https://verimots.pfa87.cc/dictionnaires.html
- https://verimots.pfa87.cc/dictionaries.html
- https://verimots.pfa87.cc/diccionarios.html
- https://verimots.pfa87.cc/diccionaris.html
- https://s.pfa87.cc/privadesa.html
