# Verimots

Offline French, English and Spanish word checker, rack search and letter challenge.
Web at [s.pfa87.cc](https://s.pfa87.cc/) and native Android (`cc.pfa87.verimots`).

The bundled word lists are community-maintained. Verimots is not Larousse, Mattel, WGPO or any federation.

English has two lists in Settings: a community list following CSW (YAWL, the closest public-domain match — not official Collins) and WGPO Official Words 2024 (WOW24). Official CSW is HarperCollins copyright and is not bundled. New English sessions default to WOW24.

## Layout

- `web/` — static site (check, tiroir, défi, privacy)
- `android/` — native app (Gradle)
- `scripts/` — define proxy, game/auth API, APK build
- `tests/` — Node tests

## Run the site locally

```sh
npm install
npm test
npm start
```

Opens `http://127.0.0.1:4174`. Google sign-in and the live leaderboard still talk to production unless you point `WEB_CLIENT_ID` at your own OAuth client.

## Android

```sh
bash scripts/build-apk.sh
```

Needs a JDK 17, Android SDK, and the release keystore at `~/.config/aiconglomerate/ods9.keystore`.

Play package: `cc.pfa87.verimots`. Listing copy and icons are in `android/play/`.

## English lexicons

- CSW stand-in (YAWL): `node scripts/build-en-lexicon.mjs`
- WGPO WOW24: `node scripts/build-wow24-lexicon.mjs`

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
