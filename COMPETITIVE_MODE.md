# Verimots game and account API

The app is hosted at `s.pfa87.cc`. The standalone host serves the same modules
from this repository and isolates test state under `.local-state/`.

## Current contract

- `GET /api/game/trail?lang=fr` returns the opening rack for the Paris ISO week.
  Language and beginner mode have separate trails. The trail is weekly, not daily.
- `GET /api/game/board` supports language, category and day/week/all-time filters.
  Bingo totals accumulate server-recomputed percentages; activity categories count
  valid word events. Public results omit Google account IDs and session tokens.
- `POST /api/auth/guest` creates or resumes a pseudonymous guest account.
  Online play and word activity can use this account without Google sign-in.
- `POST /api/auth/google` verifies a Google ID token. When upgrading a guest,
  its accumulated play data is adopted by the Google-linked account.
- `GET /api/auth/me` returns the authenticated profile and statistics.
- `POST /api/auth/logout` revokes the current signed session and clears its cookie.
- `POST /api/game/compete` submits a word/rack for server validation and scoring.
  The opening weekly rack is checked. Later racks are currently client chosen.
- `POST /api/game/activity` submits a valid check/find/training event with a stable
  event ID and owner. Duplicates are rejected within the bounded retention window.
- `GET`, `POST`, `DELETE /api/game/history` read, add or clear account history.
  New clients send an owner guard so a changed session cannot redirect a write.
- `GET /api/game/stats` and `POST /api/game/score` retain the legacy aggregate
  percentage endpoint. It is distinct from authenticated activity and Bingo.

## Storage and integration

`ODS9_GAME_FILE`, `ODS9_TRAIL_SALT_FILE`, `ODS9_LEADERBOARD_FILE`,
`ODS9_AUTH_DB_FILE`, `ODS9_FEEDBACK_FILE`, `ODS9_SIGNUP_FILE`, and
`ODS9_SESSION_SECRET_FILE` override the corresponding private storage paths.
`SESSION_SECRET` overrides the persisted HMAC signing secret. Keep these outside
public directories and Git. The embedded Mac host retains its existing private
storage locations; `npm start` sets isolated local paths before loading the APIs.

`WEB_CLIENT_ID` overrides the configured Google web client ID. Browser origins
must be authorized in that OAuth project. The Android browser fallback uses a
one-use random state bound to the initiating app; credentials in the HTTPS return
page use a fragment and are immediately removed from its address.

The host imports `ods-game.mjs`, `ods-define.mjs`, and `http-safety.mjs` together.
The shared AiConglomerate host still owns routing, security headers, analytics
injection and its other apps. Restart it after updating imported API modules.

## Release limits

The leaderboard is not resistant to a modified client: later racks and repeat
submissions are not backed by server-issued one-use rounds. English competitive
validation also uses YAWL while the client can select WOW24. Both need a coordinated
web/Android/API protocol change before competitive scoring can be relied upon.
JSON writes are atomic per file and serialized within one Node process, but updates
spanning profile and board files are not a database transaction. Run one writer.

See `RELEASE_REVIEW.md` for evidence, severity and acceptance checks.
