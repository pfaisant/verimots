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
- Source version and published APK version differ intentionally: 4.8.1/84
  is an unpublished candidate; web/apk.json describes published 4.8.0/83.
  Git synchronization alone must not publish artifacts or overwrite it.
- Run npm test for source changes. For native changes, also perform an
  Android build when the SDK/signing environment is available.
- Consult docs/source-sync-20260921.md for provenance and release history.
