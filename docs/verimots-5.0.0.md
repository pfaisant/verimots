# Verimots 5.0.0 — one leaderboard, one look (23 September 2026)

**Published**: Android 5.0.0 / versionCode 85, package `cc.pfa87.verimots`,
same Play upload key (SHA-1 `60:14:D1:85…:69:D2`). Web shell `?v=20260923-v5`,
service worker `verimots-v164`. The 4.8.1 candidate (code 84) was never
published; 5.0.0 contains it.

- APK SHA-256 `dc1d26ec7237e169f276325fab5562289279735f5a0322e53c8d5ecc77734ed9`
  (same bytes from downloads.pfa87.cc/verimots-5.0.0.apk and s.pfa87.cc/verimots.apk)
- AAB SHA-256 `b6113ec3f611c048bb36d51bdd595d4f704cc52122f10ddbe5e36f83848e1961`
- AppShelf catalogue (`downloads.pfa87.cc/releases.json`) lists 5.0.0 with that hash.

## Leaderboard parity (the request)

The web board gained rolling periods and a language filter on 21 Sep 2026; the
APK dialog had only category × day/week/all-time for the UI language.
`LeaderboardDialog.java` is now the web board (`dashboard/s/leaderboard.js`):

- Filters: **Category**, **Language** (all languages, FR, EN, ES, CA), **Period**
  (day, week, last 7 days, last 30 days, all-time). Same defaults as the web:
  all activities · all languages · last 7 days. Same request
  (`/api/game/board?category=&scope=&lang=any|fr|…`) through
  `RemoteApi.fetchLeaderboard`; the unused `fetchCategoryBoard` is gone.
- Same rows: medal discs for 1–3, a flag per row on the all-languages board,
  the per-activity breakdown ("Trouvés 25 · Combinaisons 12 …"), percent and
  games for Bingo, unit in small type after the number, own rows kept under the
  page (all of them, matched by rank *and* language), "Ta place : #5 · …".
- Same summary line and rule text (strings copied from the web in
  `res/values*/board_v5.xml`), and the web's "À toi de jouer →" on an empty
  board, which opens the matching game.
- Filters are remembered (`lb.*` prefs). The web now does the same
  (`localStorage['verimots-lb']`; a URL parameter still wins).

## Web ↔ APK alignment

- **Word of the day**: the APK hashed `day|lang|dict`, the web
  `day|lang|dict|edition`, so the two showed different words every day
  (BOLDUCS vs DEGRIMES on 23 Sep). The APK now uses the web key and, like the
  web, steps past up to three candidates with no definition or only inflection
  senses. Both show DEGRIMES today.
- **Tokens**: `colors.xml` takes the web `:root` values (background `#141e19`,
  card `#1d2922`, tile `#f3e5c2`, ink, dim, hairlines). The window, status and
  navigation bars follow `felt_dark`.
- **Type**: no serif anywhere (the web display face has been the system sans
  for months); the old "Les jeux" heading is gone as on the web.
- **Game menu**: every surface uses the cream tile icon (web desktop already
  did; the phone web and the APK used a gold glyph).
- **Game screen**: rack, answer and feedback sit in one card as on the web; the
  answer field is the web's dark well with a gold rim; the find-a-word goal
  ("Le mot le plus payant gagne…") now shows under the field; the header
  "Retour" appears only inside a game, not on the menu.
- **Dock**: a single score is no longer drawn as an empty chart, and
  Combinaisons no longer shows the find-a-word score.
- **Navigation**: the active tab is the same gold pill on desktop, phone web and
  APK; the Play tab uses the web controller icon instead of a die.
- **Words**: the feedback button said "Feedback" in French and Spanish; it now
  says Avis / Opinión like the web.
- **Web phone leaderboard**: category on its own line, language + period below
  (three columns truncated all three labels); rows per page follow the screen
  height instead of a fixed three. Filter label shortened to Langue/Language/
  Idioma/Llengua on web and APK.

## Checks

- `node --test tests/ods-*.test.mjs tests/ga-verimots.test.mjs
  tests/es-tiles-parity.test.mjs tests/download-hosting.test.mjs`: 185 tests,
  183 pass, 1 fail, 1 skipped. The failure ("each language dictionary …
  SCRABBLE is a trademark") predates this release: the trademark sentence moved
  from the About text to the Dictionaries page and the test was not updated.
- `tests/ods-leaderboard-client.test.mjs` was failing since 21 Sep (it still
  expected checks/week/en defaults); updated to the published defaults, plus a
  new case for the 7d/30d list and remembered filters.
- `lintRelease`: 0 errors (one `NewApi` caught and guarded), 205 warnings.
  `android/ods9/tests/run-auth-state-tests.sh`: 11 checks.
- Emulator (API 36, 411 dp and 320 dp, FR and EN): leaderboard every
  filter against live data (14 positions / 7 days / all languages matches the
  web; Bingo 30 days; Catalan; empty board → play), check tab word of the day,
  game menu, find-a-word validation, Combinaisons, published APK upgrade in
  place. Web previewed from the repo at 1280×800 and 390×844, no horizontal
  scroll.
- Not tested: a physical phone, Google sign-in on 5.0.0, Bingo as a signed-in
  ranked player.

Screenshots: `~/Dev/_agent_work/verimots-5/{web,web2,apk}/`.
