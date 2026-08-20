# Verimots

Offline French, English and Spanish word checker, rack search and letter challenge.
Web at [s.pfa87.cc](https://s.pfa87.cc/) and native Android (`cc.pfa87.verimots`).

The bundled word list is community-maintained. Verimots is not Larousse, Mattel or any federation.

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

## Spanish lexicon

Spanish uses the MPL-1.1 RLA-ES dictionary, normalized for single-letter word-game
tiles while preserving Ñ. Rebuild it with:

```sh
python3 -m pip install -r scripts/requirements-lexicon.txt
python3 scripts/build-es-lexicon.py
```

See `THIRD_PARTY_NOTICES.md` for attribution and transformation details.

## Legal pages

- https://s.pfa87.cc/confidentialite.html
- https://s.pfa87.cc/privacy.html
- https://s.pfa87.cc/privacidad.html
- https://s.pfa87.cc/support.html
