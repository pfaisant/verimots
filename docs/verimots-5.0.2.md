# Verimots Android 5.0.2 — technical log and the silent Google sign-in

Published 5 October 2026 on downloads.pfa87.cc (AppShelf), versionCode 87,
package `cc.pfa87.verimots`, signed with the usual upload key
(SHA-1 `60:14:D1:85…:69:D2`). **Not uploaded to Google Play**; the Play listing
still serves 4.8.1 (updated 21 Sep 2026, read on the public listing page).

## The report

Paul: "nothing happens after selecting my account when logging in. maybe need a
button to display logs and view the background errors".

## Cause (reasoned from the library, not yet seen on the phone)

- `androidx.credentials` play-services-auth 1.3.0 turns every Google
  `ApiException` with status 16 into `GetCredentialCancellationException(<Google's
  message>)` (read in the bytecode of
  `CredentialProviderGetSignInIntentController`); a real dismissal instead carries
  the library's own text "activity is cancelled by the user."
- Google answers status 16 "Account reauth failed" **after the account has been
  picked** when the app's signing certificate is not registered as an Android
  OAuth client for the web client `617674779621-…`.
- `CompetitiveMode.onError` returned silently on any cancellation, so that
  refusal looked like nothing at all.
- The copy on Google Play is re-signed by Google's app-signing key, which is
  not the upload key. If that key's SHA-1 is not registered in Google Cloud, the
  in-app sign-in fails exactly this way. The Play copy is also missing from
  `dashboard/s/.well-known/assetlinks.json` (it lists only the upload key's
  SHA-256), so the `https://s.pfa87.cc/auth-android-done.html` app link is not
  verified for it. The `intent://auth…;package=cc.pfa87.verimots` hand-back still
  works without that.
- Not confirmed: which copy Paul runs. The new log's header answers it
  (installer + certificate).

## Changes

- `DiagLog` (new): technical log in the app's private `files/diag.log`, last
  400 lines, survives restarts and updates, records an uncaught crash before the
  process dies. The header shows version, Android/device, installer (Google Play
  or not), signing certificate SHA-1 and SHA-256 (flagged when it is not the
  release key), Google Play services version and session kind. Lines: every
  sign-in step (Credential Manager option, Google's answer or error class + message,
  fallback chosen, server refusal, browser opened, browser hand-back accepted or
  refused, answers dropped because a newer attempt replaced them) and every
  failed server call (`RemoteApi`: endpoint + HTTP status or exception).
  `AuthDiag.scrub` removes JWTs, `token/state/idToken/nonce` values and email
  addresses from every line.
- UI: Options → À propos card, "Journal technique" link beside the version
  line; the dialog has Effacer / Copier / Partager. After an attempt that did
  not end signed in, the account card says so and offers "Se connecter dans le
  navigateur" and "Journal technique". Four languages (`res/values*/diag.xml`).
- Sign-in: a cancellation is the player's only when its message says "cancel" and
  not "reauth" (`AuthDiag.userCancelled`). "Account reauth failed" /
  "Developer console is not set up correctly" / 28444 (`googleRejectedApp`) skips
  the account sheet (same refusal) and opens the browser sign-in with a toast.
  A session check that comes back `not_logged_in` while an attempt is running
  now only clears the stale session; before, `signOut()` bumped the generation
  and silently dropped the attempt.
- `<queries>` for `com.google.android.gms` (version in the log), R8
  `-keepnames class * extends java.lang.Throwable` (readable names in the log).
- Also shipped: the "3 derniers jours" leaderboard period (source change of
  5 Oct, web already live; checked in the APK against the live board).
- `scripts/build-ods9-apk.sh`: build-tools 37.0.0's apksigner prints
  `V2 Signer: certificate SHA-1 digest:` instead of `Signer #1 certificate …`;
  the signer check accepts both, and reads `Number of signers:`.

## Checks

- `bash android/ods9/tests/run-auth-state-tests.sh`: BrowserAuthState 11,
  AuthDiag 21 checks (cancel vs refusal, scrubbing, fingerprints).
- `./gradlew lintRelease`: 0 errors, 207 warnings (the one error found on the
  way, a restricted `GetCredentialException.getType()`, was removed).
- Emulator `verimots-design-20260917` (port 5590, Android 16, no Google Play
  services, WebView test browser): in-place update from 5.0.1; sign-in tap →
  both Credential Manager options fail `NoCredentialException` → browser opens;
  back in the app the card shows the failure text and both links (Catalan and
  French fit on one row); the log lists every step; a forged hand-back with a
  wrong state is refused and logged without the token; log persists across a
  force-stop and an update; Share opens the system sheet with the report; Clear
  empties it; the 3-day leaderboard loads. Two ANR dialogs on the first cold
  run were the uncompiled first frame (main thread drawing a ripple), not the
  new code.
- Published APK SHA-256 `490d30102f94a221e6042d384e31e74557e865e049af5d7207dce307fd45c8f4`
  (AAB `8070b51214d4272e0dd57a29c2c7a8a0e9abf88a0e597de33f548ff2ab20e0a8`);
  `downloads.pfa87.cc/releases.json` lists 5.0.2/87 with that hash, and both
  `verimots-5.0.2.apk` and `verimots.apk` downloaded with it.

## Not tested

- The real "[16] Account reauth failed" path: no AVD here has Google Play
  services with an account.
- A real Google account end to end, and a physical phone.

## For Paul

1. In the app: Options → Journal technique → Partager (or Copier) and send it.
   "Installed by: Google Play" plus a SHA-1 not marked "release key" confirms
   the cause.
2. If so, the fix that also repairs the Play copy without an update: in Play
   Console, Verimots' App signing page (under App integrity), copy the **app
   signing key certificate** SHA-1 and SHA-256 (not the upload key's). Then Google Cloud Console →
   project of client `617674779621-…` → APIs & Services → Credentials →
   Create OAuth client ID → Android, package `cc.pfa87.verimots`, that SHA-1.
   Send the SHA-256 so it can be added to `dashboard/s/.well-known/assetlinks.json`.
3. Upload `dashboard/s/verimots-5.0.2-87.aab` to Play when convenient. A Play copy
   and the AppShelf copy have different signers, so neither can update the other
   in place.
