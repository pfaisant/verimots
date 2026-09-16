# Verimots web release review - 2026-09-16

Scope: game.js, competitive.js, worker.js, tiles.js, kids.js, favorites.js,
history.js and sw.js. Review started against the Mac source, then all eight
modules were rebased on the newer deployed v157 files before applying fixes.
The root agent owns the final shared version bump and the remaining web UI.
No production application state, accounts, scores or Git refs were changed by
this review task.

## Fixed

### Game and dictionary correctness

- Spanish/Catalan pattern lookup previously selected its search pool by the
  display-string length, then compared display strings against a character
  wildcard. CH/LL/RR, NY/QU and L-middle-dot-L were omitted or counted wrongly.
  Patterns now encode and match tiles; punctuation is escaped and all supported
  blank markers are one tile.
- Forced kids opening racks were truncated at seven tiles in both parseRack and
  the worker, despite the curated pool containing eight-tile answers. They now
  retain eight tiles, while ordinary challenge links retain their seven-tile
  limit.
- Hint lengths now count tiles, not display characters. Game input allows
  multi-character tiles represented by a blank.
- Catalan dictionary exports used a French filename; DISC now has its own name.
- Async preview/validation responses cannot mutate a later rack even if its
  current input happens to match the earlier word. Deal guards also account for
  Spanish tile-edition changes.
- Plain-mode dictionary refresh now uses the same guarded deal path, avoiding
  old answer groups being applied to a newly dealt rack.
- A failed deal exposes the existing next button as a retry instead of leaving
  the player on a disabled input with no recovery action.
- Rejected definition requests produce the existing offline message. Root-word
  requests are invalidated by subsequent tabs/back navigation or new rounds.
  Back navigation no longer constructs an invalid '#' selector for definition
  panels without IDs.
- Result definition tabs have a linked tabpanel, roving tabindex, and
  Left/Right/Home/End navigation. Shared modal focus behavior belongs to root's
  app.js changes.

### Storage and authentication

- Session-storage denial and quota failures no longer crash mode routing or
  revert the selected mode; the current tab keeps an in-memory selection.
- Accessing a denied localStorage getter no longer crashes score/training
  recording at the end of a round. Score reads are capped to the intended 24.
- Clearing local history also removes the old session copy. An explicitly empty
  local history no longer reimports a legacy session history on the next read.
- Favorites/history reads normalize data, reject overlong words, deduplicate,
  cap at the declared limits, and reject non-finite numeric values.
- Yesterday grouping uses the preceding calendar date rather than subtracting
  24 hours across a daylight-saving transition.
- Logout preserves the last confirmed account on network/server failure and
  returns an explicit result. Root must (and has been asked to) honor the result
  in app.js before painting a signed-out state.
- Google script initialization shares one in-flight request, has a deadline,
  removes a failed script and supports retry. A load event without Google's
  usable API is treated as a failure.
- History fetch/save/delete now use the existing bounded credentialed,
  uncached JSON request helper instead of unbounded fetches.

### Offline and update behavior

- Lexicon downloads have a deadline, retry the existing plain-file fallback
  after failed/corrupted gzip, and accept CRLF text lists.
- The service worker no longer forcibly replaces a worker serving an active
  game. A completed new installation waits until existing controlled tabs close.
- Activation removes only previous numbered Verimots caches, preserving other
  applications' caches on the origin.
- Cache writes extend the event lifetime and consume quota/storage rejections;
  those failures no longer generate unhandled promises or affect network success.
- Navigation 5xx responses fall back to the cached page. Offline fallback uses
  the current Verimots cache, with a defined 503 response if no shell is available.
- Page query strings no longer create separate runtime page cache entries.
- French/English privacy and support pages join the pre-cached shell.

## Evidence

- Added tests/web-release.test.mjs: 15 tests passed with Node v24.21.0 after the
  integrated v158 asset bump.
- Real bundled RLA-ES and DISC gzip files are loaded for pattern and kids tests.
  Other tests intentionally inject denied storage, failed fetches, deadlines,
  concurrent script loads, delayed word probes, worker failures and cache quota
  failures to exercise reproducible failure paths.
- JavaScript syntax checks passed for game.js, worker.js, competitive.js and
  history.js. git diff --check reported no whitespace errors for the eight owned
  modules.
- The new game lifecycle tests use a small DOM fixture. They test state ordering
  and retry behavior; they are not a visual or assistive-technology substitute.

## Remaining release checks / limitations

- The root agent must run the complete integrated test suite after synchronizing
  every versioned import, including existing test imports. Query-version module
  mismatches create independent i18n state in Node and browser module graphs.
- Browser visual/responsive checks, an actual installed PWA update/offline cycle,
  screen-reader behavior, Android/WebView and Safari must be checked in their
  real environments. This review does not establish exhaustive correctness.
- The repository carries compressed dictionaries only. The plain-file fallback
  needs server support or shipped text files to help browsers without
  DecompressionStream. The backend reviewer/root have been notified.
- No real Google account was signed in/out and no score/history writes were
  sent to production. OAuth client/domain setup and cookie behavior remain
  integration checks; mocked tests do not validate Google's deployment setup.
- The live v157 deployment includes new activity.js, icons.js and leaderboard.js
  absent from the older Mac source. Root was notified and owns their integration
  and review; omitting them would break this newer game module.
- A waiting service-worker update takes effect when existing tabs close. This
  deliberately preserves an in-progress round; it is not immediate hot reload.
- Existing offline/local score behavior is preserved. Ranked request ambiguity
  is not silently retried, and offline score synchronization is not promised by
  these changes.
- Dictionary source/licensing, distribution metadata, release signing and the
  Mac synchronization proof are handled outside this web-module task.

## Privacy copy follow-up

Root subsequently assigned the four existing privacy pages. They now carry
16 September 2026 dates and describe code-observed guest sessions, optional
Google linkage, automatic word/play activity, word/rack/event transmissions,
public ranking fields and local versus server copies. Each has a prominent
#delete-account section with the existing support email, guest/account
identification guidance and explicit distinction between clearing local data,
clearing history, and deleting account/ranking/activity data. No deletion SLA
or legal compliance assurance was added. French duplicate analytics prose was
removed; contact details and dictionary links were preserved.

RELEASE GATE: The existing declared audience (not directed at under-13s) was
not changed. The product offers a kids mode with automatic guest creation and
ranked tracking. The owner must resolve intended audience, actual tracking
behavior and matching store/privacy declarations before an official release.
Editing the policy alone does not resolve that product decision.

## Independent integration review

- Found that standalone serve.mjs did not implement the extensionless
  /leaderboard route present in the service-worker precache list. That 404
  rejects the entire shell installation. Root/backend reviewer were notified
  to add the route and test every shell URL.
- Found history POST/DELETE requests could cross an account change despite
  root's read-side guards. competitive.js now captures/sends the owner for
  writes/deletion and rejects an explicitly stale caller without fetching.
  Root owns the corresponding app.js capture; backend owns server enforcement.
  Added a passing regression for this transport behavior.
- Read root's app.js, landing and Android auth changes. No further concrete P1
  regression was found in that pass. Production's shared analytics injector is
  outside this source snapshot; auth handoff pages must be exempt from analytics
  so credentials in the fallback URL fragment cannot be observed before the
  module scrubs it. Root was notified as an integration check, not a proven leak.
