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
- Windows D:/Perso/AiConglomerate is an older dirty checkout. Its unrelated
  work is preserved; do not treat its Android version as the latest release.

Imported tracked source mappings: dashboard/s -> web,
dashboard/verimots -> landing, android/ods9 -> android; shared backend
modules keep their scripts paths. Font assets, generator and release notes
are included. Generator paths are adapted to the standalone layout.
The Mac standalone auth regression tests are retained. Its four modified
source files are represented by the newer deployment source (auth HTML also
updates the favicon cache version). An archive of the original dirty files
is retained at D:/_agent_work/verimots-dirty-20260921.tar.gz and
/tmp/verimots-dirty-20260921.tar.gz on the Mac.

Tests importing web modules now use cache version 160 to share the same
language state as the deployed modules. Public web/apk.json deliberately
remains 4.8.0 while package.json and Android source identify candidate 4.8.1.
