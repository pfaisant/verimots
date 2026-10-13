# Verimots workspace

- Canonical Windows checkout: D:/Perso/verimots. Work on main or a feature
  branch in this repository. Do not create another standalone checkout in
  D:/tmp or D:/_agent_work for routine work.
- web/, landing/ and android/ are the application sources. AiConglomerate
  contains deployment mirrors, not an independent development source.
- Keep temporary evidence, local builds, release artifacts and backups under
  .local/ (Git ignored). Never commit credentials or signing keys.
- .local/archive/20260921 contains preserved historical work; moves.json
  maps old paths. Do not treat archived clones as active workspaces.
- web/apk.json describes the published 5.1.1/89. The source also carries the
  unpublished joker picker, so the next Android upload needs a new
  versionCode. Git synchronization alone must not publish artifacts.
- Run npm test for source changes. For native changes, also perform an
  Android build when the SDK/signing environment is available.
- Consult docs/source-sync-20261013.md and docs/source-sync-20260921.md for
  provenance and release history.
