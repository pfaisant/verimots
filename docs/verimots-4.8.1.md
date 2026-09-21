# Verimots Android browser sign-in — web fix and 4.8.1 candidate

Web recovery fix deployed 18 September 2026. **Android 4.8.1 / versionCode 84
is a tested, unpublished candidate**, package `cc.pfa87.verimots`. The user
confirmed the failing installation was 4.7 and that upgrading to the already
published 4.8 resolves login. No new APK publication was needed; public
downloads remain 4.8.0 / code 83.

The browser login page displayed only “Relancez la connexion depuis Verimots”
when opened without a valid state. APKs through 4.7.0 never sent this state;
the September 16 web hardening therefore left those installations without a
working browser sign-in or an upgrade action. The published 4.8.0 APK does
generate a device-bound state, verified against its actual DEX, but launches
the browser using `ACTION_MAIN`, which is a launcher action rather than a URL
navigation request. Restoring an old browser tab is another possible path to
the same stale login page; this specific Brave behavior was not reproduced.

## Changes

- Open the fresh login URL using `ACTION_VIEW` and `CATEGORY_BROWSABLE`.
  The manifest already excludes `/auth-android.html` from app links, so this
  does not send the login start back into Verimots.
- Show a translated APK update link when state is absent. Invalid callbacks
  also offer a safe app-opening link and an update link. No state is invented
  in the browser and native nonce validation remains mandatory.
- Prepare a visible, package-restricted “Open Verimots” handoff before
  attempting automatic launch. Browser launch failures no longer turn a
  successful authentication into an apparent Google sign-in failure.
- Keep tokens in the HTTPS fallback fragment and scrub callback URLs before
  displaying the handoff. Auth pages continue to exclude analytics. Their
  standalone module uses `v=20260918` to bypass previously cached copies.

The candidate is built from the current `AiConglomerate/android/ods9` sources,
preserving the 4.8.0 work. The login change and web tests are also mirrored to
the separate `verimots` checkout; no full-tree sync from its older release
candidate was applied.

## Validation

- 15 new login regression cases cover all four languages, missing/malformed
  states, SDK/API failures, blocked browser handoff, credential scrubbing and
  package-restricted links. The deployed auth/session/progression/startup
  subset passes 38 tests; all six analytics integration checks pass.
- The existing standalone suite passed 218 tests before the new login cases
  were added. The new cases and existing release-asset checks pass together.
- 25 local browser cases and two public smoke checks pass. Recovery layouts
  fit all four languages at 320, 390 and 1280 pixels, with separate 44-pixel
  link targets. Mocked successful login returns to the scrubbed callback page
  and retains a manual handoff; the public page loads the real Google button
  with a valid synthetic state.
- Android 36 resolves the credential-free `intent://auth` recovery link to
  Verimots. The existing APK was observed sending a complete login URL with a
  fresh 43-character state to the browser fallback.
- Candidate APK/AAB assembly and lint pass, with 0 errors and 190 warnings;
  APK signer matches the existing release and AAB strict verification passes.
  In-place upgrade from 4.7.0 to 4.8.1 succeeds. Two real sign-in taps on the
  emulator produce distinct 43-character nonces via `ACTION_VIEW` and
  `CATEGORY_BROWSABLE`, without an app-link loop. The AVD has no Google Play
  services or Brave and its web content was offline.
- Shared-dashboard syntax, build and selfcheck pass in an isolated snapshot
  of current inputs (7 existing missing-path warnings). Global verification
  passes 149/153; failures are existing tunnel monitoring gaps, stale Stripe
  and X snapshots, and the unrelated paid-product public-surface check.

The user confirms real sign-in works on 4.8. The additional 4.8.1 candidate's
complete Google account/physical-phone flow was not tested. Automated browser
tests use synthetic credentials and do not sign in to a production account.

Candidate SHA-256:

- APK: `94f1400b93fcb3c4628162b832171ec552e8ac3b673d19f3eb9c1316b11258e8`
- AAB: `3e2f4b439daac140c6c886f283d696a07d6ca5117472c9b98d590137d0e6de32`

Web/test evidence is under
`/Users/clawdbot/Dev/_agent_work/verimots-auth-20260918/`; native evidence is
under `AiConglomerate/_agent_work/verimots-auth-20260918/`.

## Source update on 21 September

The candidate source now also includes the reviewed [joker picker](joker-picker.md).
The September 18 artifact hashes above identify the earlier sign-in-only
candidate and are not hashes of a build containing the picker.
