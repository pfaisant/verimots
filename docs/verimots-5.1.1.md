# Verimots Révisions follow-up — web (9 Oct 2026) and Android 5.1.1

Paul, 9 Oct 2026: "sync, more to improve?" — three days after Révisions
(`docs/verimots-5.1.0.md`) went live.

## What the server showed first

- `~/.local/state/aiconglomerate/ods9-reviews/` did not exist: no account had
  synced a list yet [measured].
- `ods9-players.json`, 4–8 Oct: 12 player-days, all guests (APK 11, phone web 1),
  no Google account [measured]. So sync has not failed in the wild; it has not
  run. Irène's Google account last played on 3 Oct, before Révisions.

## Changes

- **Sync on return** (web and APK): coming back to the tab (`visibilitychange`)
  or to the app (`onResume`) pulls the account's list, at most once a minute
  (`syncTried` in `review.js`, `ReviewStore.lastAttempt`); the web also retries
  on `online`. Before, the menu badge only caught up with another device's
  reviews when Révisions was opened.
- **Honest sync line**: a failed sync now says "Synchronisation impossible pour
  le moment · ta liste reste sur cet appareil" (`rev_sync_failed`, 4 languages,
  web and APK) instead of "Synchronisation…" forever or a stale "Synchronisé".
  A non-JSON answer counts as a failure.
- **Android definition box** (existing glitch, seen on 6 Oct): at the end of a
  Combinaisons round the result card still showed the previous round's
  definition (e.g. a Find word). `finishTraining` now hides the panel, like the
  web; tapping an answer opens its definition as before.
- **Test**: "each language dictionary…" expected the trademark line in
  `about_p3`, which on 16 Sep moved to the four Dictionaries pages (About points
  there). The test now checks About's pointer, and a new test checks the notice
  on each Dictionaries page.
- **Privacy pages** (4 languages): "last updated" 16 Sep → 6 Oct 2026, the day
  the Révisions line was added.
- **Google Play kit** (`scripts/verimots-promo/play/`): version 5.1.1 (89), a
  Révisions line in the full description (Révisions / Review / Repaso / Repàs,
  as in the app), the 3-day leaderboard period, release notes for 89 written
  for players coming from 4.8.1 (Révisions, Google sign-in fallback and log,
  3-day boards, definitions), data-safety notes for the synced list.
- Web assets: modules `?v=162`, `app.js`/`app.css`/`leaderboard.js`
  `?v=20261009-v1`, `sw.js` cache `verimots-v174`.

## Checks

- `node --test tests/ods-*.test.mjs tests/download-hosting.test.mjs
  tests/serve-auth.test.mjs`: 184/184.
- `bash android/ods9/tests/run-auth-state-tests.sh` (needs `JAVA_HOME` =
  openjdk@17): BrowserAuthState 11, AuthDiag 21, ReviewRules 19. Lint 0 errors.
- Browser, local preview with a faked Google session
  (`_agent_work/verimots-revisions/sync-return.mjs`): badge 1 → no request when
  back within a minute → one request after a minute and badge 2 (a draw added by
  "another device") → line "Synchronisé" → network cut + `online` → failure line
  → back online → "Synchronisé"; strings present in en/es/ca; no page errors.
  `flow.mjs` (phone, signed out) still passes.
- Live, writes blocked: FR/EN/ES/CA Révisions view and menu, no errors; the
  site serves `app.js?v=20261009-v1`, `review.js?v=162` and cache
  `verimots-v174`.
- Emulator 5590: 5.1.1 over 5.1.0 keeps the 7 saved draws; Find round (PAIN)
  then Combinaisons "Voir les réponses": no definition box until SCRUBBER is
  tapped, then its definition; background + resume, no crash.
- Published: APK SHA-256
  `641bfc42a10385f2a13a4c4a7576d515ce37f32f2311dcf340df4c1c7ad7e274`
  (catalogue 5.1.1/89, `verimots-5.1.1.apk` and `verimots.apk` return it); AAB
  `d90c9fb78a5a1fb953f6d4668057c9ab5609790d2e711bed59172cf308b35ef4` at
  https://s.pfa87.cc/verimots-5.1.1-89.aab. Play kit: `verify-kit.mjs` ok
  (5 locales, 90 screenshots, 192 files).

## Not tested

- The APK's failure line and resume sync with a real account (no Google
  account on the emulator; the Android code is the same shape as the web's,
  which was tested).
- Any sync with a real Google account, on either side.
- Google Play still needs the 89 bundle uploaded (Paul).
