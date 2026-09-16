# Verimots release review - 16 September 2026

**Not ready for the first official release.** Candidate 4.7.1 (Android versionCode 82, web assets v158) contains substantial fixes and passes the checks below. Competitive integrity, dictionary consistency, distribution evidence and real-device/Play acceptance remain open.

The separate source checkout was at Android 4.3.0 / web v142 while the deployed Mac mini copy was at Android 4.7.0 / web v157. The newer deployed code and missing tests have been preserved and reconciled into this candidate. **Actual source/deployment synchronization, restart and post-sync verification are still pending.** Reconciliation of the review tree is not proof that the Mac mini is running it. Candidate artifacts have not been published; the public download remains 4.7.0.

## Release gates

| Priority | Gate | Evidence and required closure |
| --- | --- | --- |
| P1 | Ranked replay and caller-selected racks | The backend accepts chosen adult racks and awards points for repeated official answers. Throttling does not establish fairness. Introduce server-issued rounds, expiry and one-use submission receipts across web and Android, or remove trusted-ranking claims and disable the affected competitive feature. Test forged, expired, repeated and concurrent submissions, including a lost response. |
| P1 | English dictionary mismatch | Clients default to WOW24; ranked validation uses YAWL and receives no dictionary. Choose an explicit ranked dictionary or carry the selected dictionary through the round protocol. The displayed list, accepted words and score denominator must agree on both clients and the server. |
| P1 | Dictionary redistribution evidence | The repository lacks documented provenance/redistribution basis for the bundled French list; the WOW24 notice names a download without stating redistribution terms. Record source, version/hash, applicable terms and any required permission/notices. These are evidence gaps, not legal conclusions. |
| P1 | Native device and Play acceptance | Signed builds do not validate installation, OAuth or usability. Test clean install and upgrade from 4.7.0, supported old/current Android, all four languages, large text/TalkBack, navigation, Google cancellation/success/browser fallback, account switching and offline recovery. Verify production access, versionCode availability, Play app-signing OAuth setup and a Play-installed login. |
| P1 | Audience, tracking and deletion operations | Kids mode creates guest identities and records ranked activity while the declared audience excludes under-13s. Resolve intended audience, tracking behavior and matching store/privacy answers. Execute the documented account/data-deletion process, including guest identification and removal of associated history, ranking and activity records. A request link alone is not proof of fulfillment. |
| P1 | Production integration and synchronization | Apply a fresh, reviewed sync plan with an external verified backup; restart the shared host and verify deployed hashes and behavior. Apply and test the [shared analytics integration patch](integration/ga-inject.patch): auth handoff pages must bypass injection, and Verimots analytics must start denied until a choice. Confirm actual proxy/cookie handling and service-worker installation on the public origins. |

## Validation completed

| Area | Evidence | Limit |
| --- | --- | --- |
| Integrated Node suite | Final integrated rerun: 218 tests passed, 0 failed. Security, persistence, activity, session ordering, dictionaries, service worker, release assets and sync are covered. | Fixtures do not exercise real Google accounts, production writes or distributed abuse. |
| Browser review | 19 browser checks across French, English, Spanish and Catalan, widths 320-1280 px, plus offline behavior. | This is bounded browser coverage, not approval of every browser, screen reader, installed PWA update path or Android WebView. |
| Android artifacts | Signed 4.7.1 / code 82 APK and AAB built; release assembly, bundle, shrinking, signer/integrity checks and lint completed. Lint: 0 errors, 190 warnings. | No physical device or emulator was attached. No Play upload, Play-installed OAuth test or native visual acceptance occurred. |
| Native auth logic | 11 BrowserAuthState JVM checks passed; existing Spanish tile behavior checks passed. | These validate isolated logic, not the full browser-to-app handoff on a phone. |

The candidate fixes account-switch/history races, logout replay, browser-auth state validation, cancellation handling, request/storage limits, concurrent initialization and persistence failures, guest-account score merging, Spanish/Catalan tile matching and eight-tile beginner racks. It also improves denied-storage/offline recovery, service-worker updates, policy/deletion disclosures and concise interface copy. The sync helper now verifies hashes and rollback copies, excludes credentials/generated artifacts, rejects unsafe paths and serializes its own deployments.

## Prioritized follow-up

1. Close the competitive-round and English-dictionary gates together; changing only validation or only one client leaves the contract inconsistent.
2. Complete the provenance, audience and deletion decisions before finalizing store declarations and release claims.
3. Run device/Play acceptance, resolve clipping and accessibility findings from the remaining 190 lint warnings, and capture screenshots from the accepted candidate.
4. Complete the pending source/Mac deployment sync and analytics integration, rerun the full suite, then smoke-test public login/logout, owner-safe history, dictionaries, offline installation and update behavior. Preserve hashes, backup location and results with the release record.
5. Address the next reliability tranche: transactional account/leaderboard persistence, ranked submission receipts, owner-scoped offline history delivery, native round restoration after process death, feedback-mail deduplication and bounded data retention. Move the historical signing-password fallback out of tracked source without replacing the established upload key.

The JSON stores remain single-process and are not transactionally committed together. A crash between board and profile writes can leave totals inconsistent. Whole-file rewrites and all-time scans also need a scaling/retention plan. Sync replaces files sequentially, not as one atomic release; an interrupted apply requires inspection and restoration from its backup plan before retrying.

Detailed findings and test scope: [backend and deployment](docs/release-review/backend.md), [web](docs/release-review/web.md), [Android](docs/release-review/android.md). Build and sync commands: [README](README.md).
