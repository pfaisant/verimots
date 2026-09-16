# Verimots Android release review - 2026-09-16

Candidate: 4.7.1 (versionCode 82), based on the actual deployed Android 4.7.0 (81) source from `/Users/clawdbot/Dev/AiConglomerate/android/ods9`. The separate `/Users/clawdbot/Dev/verimots/android` source was stale at 4.3.0 (75). No production/native source was overwritten and no artifact was published by this review.

## Provenance and validation

- Latest native source snapshot: `D:/_agent_work/verimots-android-live-20260916/ods9`.
- All 207 source baseline SHA-256 hashes: `D:/_agent_work/verimots-android-live-baseline-20260916.json`. AppleDouble files and machine-local SDK properties excluded.
- Pre-rebase review edits preserved: `D:/_agent_work/verimots-android-pre-rebase-20260916`.
- Candidate review tree: `D:/_agent_work/verimots-release-20260916/android`.
- Isolated Mac build tree: `/tmp/verimots-android-review-20260916`.
- `assembleRelease`, `bundleRelease`, `lintRelease`, R8/resource shrinking: successful. Final lint: 0 errors, 190 warnings; this is not a clean accessibility audit.
- `scripts/build-apk.sh --build-only`: succeeds without publishing. Verifies APK signer, package/version, AAB strict JAR integrity, expected signer, required manifest, immutable release naming rules before publication.
- New BrowserAuthState JVM checks: 11 passed (random state, URL safety, exact match, missing/mismatched/expired state, expiry boundary, clock rollback, consumed state).
- Existing EsTiles pure-Java behavioral checks: passed.
- All French/English/Spanish/Catalan string and plural resources present; Catalan added to Android system locale choices.
- `adb devices -l`: no attached devices. No real phone, emulator, native screenshot, TalkBack, Google Credential Manager, Play-installed sign-in, or install/update smoke test was performed.

## Fixed findings

| Severity | Problem | Change and evidence |
| --- | --- | --- |
| P1 | Repository Android source lagged the installed/downloaded release by four minor versions | Preserved and imported latest 4.7.0 source, including activity persistence, leaderboard UI, Spanish tile model, adaptive layout and icon changes; rebased review fixes onto it. |
| P1 | Browser auth accepted any delivered session token, enabling unsolicited account replacement | Added cryptographically random device state, private persistence, 10-minute TTL, constant-time verification and one-time consumption; HTTPS callback reads fragment, callback intent is scrubbed; shared web pages must propagate `state`. |
| P2 | Google cancellation reopened sign-in and could fall through to browser; each attempt leaked an executor | Cancellation now returns; uses main executor; cancels pending credentials and ignores stale callbacks after sign-out/new request/activity destruction. |
| P2 | Async authentication/history work could cross an account switch | Auth generation and token guards added; history read/write/delete requests capture the initiating session; late responses cannot repopulate signed-out history or mutate another account. |
| P2 | History deletion looked successful offline, then old cloud entries returned | Signed-in local history clears only after confirmed server deletion; localized failure shown. |
| P2 | Cloud histories merged into one device list across Google accounts | Account-specific history storage uses stable owner; existing device-only history preserved and never bulk-uploaded to another account. |
| P2 | Offline activity queue was unbounded and tied to short-lived session tokens | Cap 200 events per identity, expire after seven days, stable-owner keys; only the exact current session's legacy queue migrates; ownerless and other-account events are never reassigned. |
| P2 | Public web privacy/support URLs opened the app instead of their page | Verified app links restricted to app entry and auth completion; native policy/data-deletion link opens localized policy `#delete-account`. |
| P2 | Modern Android device transfer could copy session material despite backup intent | Explicit data extraction exclusions added for cloud backup and device transfer, consistent with existing allowBackup=false. |
| P2 | App discarded the user's chosen system font size | Removed deliberate 1.0 font-scale clamp. Large-font visual verification remains required. |
| P2 | Native sign-out only forgot local credentials | Best-effort server logout now invalidates the captured old session; local sign-out remains available offline. |
| P2 | Network response parsing leaked resources on failures and had no response bound | JSON reads now close/disconnect in finally and enforce 2 MB maximum response size. |
| P2 | Old canonical build script overwrote aliases without checking artifact identity | Ported the newer deployed build script to canonical android/web paths, added lint gate and explicit --build-only. |

Earlier observations that Android 16 Back and anonymous-data disclosure were broken applied only to stale 4.3.0 source. They were already fixed in deployed 4.7.0, whose implementations are preserved. Android 16 ignores legacy `onBackPressed` for API36-targeted apps; the current native code already registers OnBackInvokedCallback. Source: https://developer.android.com/about/versions/16/behavior-changes-16

## Remaining release gates and improvements

1. **P1 - Verify actual Google Play production readiness.** No Play Console evidence was available for closed-test completion, production access, data-safety answers, app-signing OAuth SHA-1, or availability of versionCode82. For relevant new personal accounts, Google requires 12 continuously opted-in testers for 14 days before applying for production access: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en . Upload signing validation alone does not test Google login on a Play-signed install.
2. **P1 - Real-device smoke and accessibility review.** Test clean install and upgrade from4.7.0, Android8/API26 and Android16/API36, back/keyboard/insets, four languages, Google cancellation/success/browser fallback, account switches, offline/online recovery, and large text/TalkBack. No physical or emulated Android device is attached. Removing the font clamp exposes pre-existing fixed-height/single-line layouts that may clip at large text sizes.
3. **P2 - Persist active rounds and pending ranked submissions.** MainActivity has no onSaveInstanceState/restore implementation for its current deal, input and pending-ranked fields. OS process death/recreation can discard a current round or an unconfirmed score submission. Rotation is specially handled by configChanges but process death is not.
4. **P2 - Offline cloud history still needs an owner-scoped outbox.** Explicit history writes in RemoteApi.saveHistory fail silently when offline; the local account history is retained but ActivityStore only queues activity events, not history writes. Do not solve this by uploading all local history on login: device-only history has no proven account ownership.
5. **P2 - Finish native large-text/reading polish on a device.** Lint still has190 warnings (including small text, hardcoded text/plural candidates, layout cost and resource debt). Avoid treating the successful build as visual approval. MainActivity remains roughly4,000 lines; move isolated views/features out incrementally after behavior is covered.
6. **P2 - Review and move the historical keystore-password fallback out of tracked source.** app/build.gradle and the existing signing build path still contain a historical default password. The private keystore itself was not copied or exposed. Migrating build credentials must preserve the established upload key; do not generate a replacement key.
7. **P2 - Confirm data-deletion operations behind the new links.** Native now exposes the localized policy/delete-account section. The operator must execute authenticated requests and remove associated server data; an accessible request link alone does not prove fulfillment. Google policy source: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en .
8. **P3 - Refresh store screenshots/listing from the final app.** The imported play/ assets include older release notes and mockup-based images. Capture the exact candidate on real phone/tablet sizes after acceptance; do not publish screenshots that imply an untested UI.

## Intentional behavior changes

- First use after upgrade: a Google account's history repopulates from its cloud data. The old device-only list remains local; it is not assigned to that Google account.
- Events created before any server identity existed remain local rather than being credited automatically to a later identity. Pending activity per identified account is limited to its newest200 events within seven days.
- Signing out offline clears the local session immediately; the best-effort server invalidation needs a connection.
- Candidate artifacts remain separate from public4.7.0 downloads pending device/Play acceptance.
