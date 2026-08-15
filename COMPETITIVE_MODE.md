# Verimots Competitive Mode API

## Overview

Verimots now supports competitive mode with daily challenges, leaderboards, and Google authentication.

## Environment Variables

- `WEB_CLIENT_ID` - Google OAuth2 client ID (required for authentication). Without this, `/api/auth/google` returns 503.
- `SESSION_SECRET` - Secret for signing session tokens (optional, generates ephemeral secret if not set)
- `ODS9_GAME_FILE` - Anonymous stats file (default: `~/.local/state/aiconglomerate/ods9-game.json`)
- `ODS9_TRAIL_SALT_FILE` - Trail seed salt file (default: `~/.local/state/aiconglomerate/ods9-trail-salt.txt`)
- `ODS9_LEADERBOARD_FILE` - Leaderboard data file (default: `~/.local/state/aiconglomerate/ods9-leaderboard.json`)
- `ODS9_AUTH_DB_FILE` - Auth database file (default: `~/.local/state/aiconglomerate/ods9-auth.json`)

## API Endpoints

### Anonymous endpoints (unchanged)

- `GET /api/game/stats` - Get average score from all anonymous submissions
- `POST /api/game/score` - Submit anonymous score `{ percent: 0-100 }`

### Daily trail (public)

- `GET /api/game/trail` - Get today's deterministic challenge
  - Returns: `{ ok: true, trailId: "YYYY-MM-DD", category: "bingo|long|hard", rack: "LETTERS" }`
  - Trail ID is in Europe/Paris timezone
  - Same trail for everyone on the same day (seeded RNG)

### Leaderboard (public)

- `GET /api/game/board?trailId=YYYY-MM-DD` - Get leaderboard for a trail
  - Default: today's trail
  - Returns: `{ ok: true, trailId, top: [...], me: {...} }`
  - `top`: Array of public top 50 entries `{ rank, pseudo, percent, word?, timestamp }`
  - `me`: User's rank if logged in (null if anonymous)

### Compete (requires login)

- `POST /api/game/compete` - Submit ranked score
  - Requires session cookie `ods9_session`
  - Body: `{ percent: 0-100, word?: "WORD" }`
  - One attempt per user per trail (first score wins)
  - Returns: `{ ok: true }` or `{ ok: false, error: "already_submitted" }`

### Authentication

- `POST /api/auth/google` - Sign in with Google
  - Requires `WEB_CLIENT_ID` env var
  - Body: `{ idToken: "..." }` (Google ID token)
  - Returns: `{ ok: true, user: { sub, name, picture } }` with `ods9_session` cookie
  - Returns: `{ ok: false, error: "google_not_configured" }` if `WEB_CLIENT_ID` is not set (503)
  
- `GET /api/auth/me` - Get current user
  - Requires session cookie
  - Returns: `{ ok: true, user: { sub, name, picture } }`

- `POST /api/auth/logout` - Sign out
  - Clears session cookie
  - Returns: `{ ok: true }`

## Implementation Notes

- Daily trails use a seeded RNG with a server salt (generated on first run)
- Same trail ID + salt always produces the same rack
- Sessions are signed with HMAC-SHA256
- Google `sub` is the stable user identifier (never exposed publicly)
- Leaderboard shows pseudo (user's name) not their Google ID
- First score per user per trail is final (no retries)
- All new routes are added to `PUBLIC_PATHS` in `serve.mjs`

## Client Integration

The anonymous random challenge mode is unchanged. Clients can:
1. Continue using `GET /api/game/stats` and `POST /api/game/score` for anonymous play
2. Optionally load `GET /api/game/trail` for the daily challenge
3. Show `GET /api/game/board` to display rankings
4. Enable `POST /api/game/compete` when user is logged in

**Important**: No live Google button is deployed. The auth endpoints are wired but inactive until `WEB_CLIENT_ID` is configured.
