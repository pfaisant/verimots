# Verimots source synchronization — 21 September 2026

Published download: 4.8.0 / versionCode 83. Current source: unpublished
4.8.1 / versionCode 84. This sync does not publish an APK or Play release.

The 4.8 source was not lost. It was developed in pfaisant/AiConglomerate:
- 789ca4e7: September 17 snapshot containing the published 4.8.0 source.
- 11ff3345: September 18 snapshot containing the 4.8.1 candidate.
- Imported from Mac HEAD 9c05e398195e2b9551b5ba364cc29995278016ec.

Locations:
- Windows standalone: D:/Perso/verimots
- Mac standalone: /Users/clawdbot/Dev/verimots
- Mac deployed source: /Users/clawdbot/Dev/AiConglomerate
- Windows existing worktree: D:/tmp/games-omarchy (AiConglomerate,
  games-omarchy-tab); it already contains both snapshots.
- Windows D:/Perso/AiConglomerate is a separate, actively edited shared
  repository. Its work is preserved; Verimots development belongs here.

Imported tracked source mappings: dashboard/s -> web,
dashboard/verimots -> landing, android/ods9 -> android; shared backend
modules keep their scripts paths. Font assets, generator and release notes
are included. Generator paths are adapted to the standalone layout.
The Mac standalone auth regression tests are retained. Its four modified
source files are represented by the newer deployment source (auth HTML also
updates the favicon cache version). An archive of the original dirty files
is retained at D:/Perso/verimots/.local/archive/20260921/agent-work/verimots-dirty-20260921.tar.gz and
/tmp/verimots-dirty-20260921.tar.gz on the Mac.

Tests importing web modules now use cache version 160 to share the same
language state as the deployed modules. Public web/apk.json deliberately
remains 4.8.0 while package.json and Android source identify candidate 4.8.1.

## Consolidation

The verified release/sync history is merged into main. Windows and Mac
standalone checkouts use main. The old joker-tile-picker experiment was
subsequently reviewed and integrated at the user’s request, with scoring,
Catalan and accessibility fixes. Its branch is merged and removed; Git
history retains the original commit 643a0f0. See joker-picker.md.

Windows has one active standalone checkout: D:/Perso/verimots.
Historical standalone trees, review evidence, backups and 4.7.1 artifacts
formerly under D:/_agent_work, D:/tmp/verimots-work and AiConglomerate's
_agent_work are retained under .local/archive/20260921/ (Git ignored).
The moves.json manifest records each original and new absolute path.
The archive is historical evidence, not another development checkout.
References in older review documents describe their original locations;
use the move manifest to locate them now.

AiConglomerate's tracked deployment mirrors remain in its two shared
worktrees, because removing them would change unrelated dashboard work.
Do not edit those as an independent Verimots source. Use this repository
and scripts/sync-deployment.mjs when an actual deployment is requested.
Consolidation does not deploy the 4.8.1 candidate or change public downloads.
