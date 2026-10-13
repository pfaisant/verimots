# Verimots Révisions — web (6 Oct 2026) and Android 5.1.0

Asked by Irène (email to Paul, 6 Oct 2026): « Est-ce envisageable de sauvegarder
les tirages pour lesquels on n'a pas trouvé les mots pour pouvoir les rejouer ?
Cela serait comme une section Révisions. » Paul: "make this available and have a
revision section in games… genuinely helpful for users."

## What a player gets

- **Saved automatically**, no button to remember: a Bingo or Trouver un mot round
  played below 100 % (the best word got away), passed, timed out or given up;
  a Combinaisons round that ended with words not found alone (words handed over
  in red count as missed). The result shows "↻ Ajouté à tes révisions", which
  opens the list. Beginner (kids) rounds are not saved: any valid word wins there.
- **The goal is the missed words**, not a new score: Bingo/Trouver un mot → find
  the best word again (any of up to three tied best words); Combinaisons → every
  missed word (up to 12, highest scores first). Empty letter slots show each
  word's length and points; a valid word that is not a goal is acknowledged
  ("valable, mais ce n'est pas un mot à retrouver").
- **Hints in two steps**, then the answer: first letter, then the definition with
  the word masked; "Voir la réponse" ends the round. After each draw: its
  definitions, and what the player had played that day.
- **Spaced schedule** (Leitner-style): due at once; each unaided success moves it
  to +1, +3, +7, +21 days, and one more success masters it (5 successes). A hint
  keeps the step and brings it back tomorrow; the answer shown starts it over
  (tomorrow). Replaying before the due day never moves the schedule (only a
  miss counts). "Due" = any time today on the player's clock.
- **Révisions screen** (5th card in the games menu, with a count badge, plus
  `?play=revisions` on the web): À revoir / Plus tard / Maîtrisés counts, one
  "Réviser les N tirages" session, the list with mini rack, game, goal, progress
  dots, missed date, next review, Rejouer and Retirer (with an undo). Draws of
  another dictionary (or Spanish tile set) wait, counted on one line.
- **Sync with a Google account** (web and APK): the list follows the player to
  every device. Guests and signed-out players keep it on the device.

## How it is built

- Rules: `dashboard/s/review-core.js` (pure, no imports; used by the page and by
  the server) and its Java twin `android/ods9/…/ReviewRules.java` — same item
  fields, schedule, dedupe key (`dict|edition|game[|preset|min]|sorted tiles`),
  merge (latest `updatedAt` per id wins, deletion wins a tie, duplicate draws
  collapse), limits (300 draws, 200 tombstones kept 90 days).
- Web: `review.js` (store `localStorage['verimots-reviews-v1'] = {owner, items}`,
  list, player, sync), hooks in `game.js` (`onMissed` from `validate`, `passRound`,
  `skipRound`, `finishTraining`; `tileAssignments` exported; `isClosed()`), wiring
  in `app.js` (`showGameView('review')`, which also suspends `body.game-closed`
  so the replay's form is not hidden by a closed round), markup in `index.html`,
  styles at the end of `app.css`, strings `rev_*` in `i18n.js` (4 languages).
  Racks and words are stored in display form (`CH`, `L·L`, `?`), so web and APK
  share one list.
- Server: `GET|POST /api/game/reviews` in `scripts/ods-game.mjs` — Google
  sessions only (guest 403), owner check (409), 60 writes/min, 400 KB body, POST
  = the device's whole list, answer = the merge. One file per account in
  `~/.local/state/aiconglomerate/ods9-reviews/<sha256("verimots-reviews|"+sub)[:40]>.json`
  (`reviewFileFor(sub)`); an unreadable file answers 500 and is never
  overwritten. **An account deletion request must also delete this file.**
- Android 5.1.0 / code 88: `ReviewStore.java` (prefs `verimots-reviews`, JSON
  identical to the web, sync after each change and at sign-in), `ReviewScreen.java`
  (list + player, rack through `Tiles.fill`, definitions through
  `RemoteApi.define`), hooks in `MainActivity` (`saveMiss` in `submitPlay`,
  `passRound`, `skipPlay`, `finishTraining`; Back = player → list → menu),
  layout in `pane_game.xml`, strings `res/values*/reviews.xml`.
- Privacy pages (FR/EN/ES/CA) list the new stored data.
- Web assets bumped together: modules `?v=161`, `app.js`/`app.css`/
  `leaderboard.js` `?v=20261006-v1`, `sw.js` cache `verimots-v173`.

## Checks

- `node --test tests/ods-reviews.test.mjs`: 10 tests (schedule, cutoff, early
  replay, validation, merge, deletion, duplicate draws, pruning; server: auth,
  guest refusal, owner check, two devices + a deletion, unreadable file).
- `bash android/ods9/tests/run-auth-state-tests.sh`: ReviewRules 19 checks,
  including the dedupe key equal to the web's.
- `node --test tests/ods-*.test.mjs`: 162/163; the failure is the existing
  "each language dictionary…" test (English about text changed on 17 Sep).
- Browser (local preview, live data read-only, sync in memory): Trouver un mot
  give-up and Combinaisons "Voir les réponses" saved; session of two with a
  wrong word, both hints, a found word (→ help, tomorrow) and a shown answer
  (→ tomorrow); banner kept after the sync repaint; signed-in sync and a second
  device's draw merged; another dictionary's draw left out of the counts; no
  horizontal overflow at 390 and 1280 px; no page errors.
- Live after the restart: endpoint answers `login_required`; site, menu card and
  `?play=revisions` checked in FR/EN/ES/CA with writes blocked; no page errors.
- Android emulator (5590): menu card, give-up and Combinaisons 7+1 saved, list,
  session with hints (first letter, masked definition) and answer, early replay
  message, end-of-session banner, delete + undo, Back, list kept across an
  update; no crash. Lint 0 errors.
- Published APK SHA-256 `d37c3885385c3ebe7a887b3e0d45e37f2550cc0856e5892a74bff1289e6ffbe3`;
  catalogue lists 5.1.0/88 and both download URLs return that hash.

## Not tested

- Android sync (no Google account on the emulator); real Google sign-in on the
  web (sync was tested with a faked session against an in-memory server).
- A physical phone.
- The Google Play copy still serves 4.8.1; 5.1.0 is AppShelf only.
