# Third-party notices

## YAWL (CSW stand-in)

The English CSW option uses public-domain YAWL (Yet Another Word List) by
M. Leo Cooper as the closest redistributable match to Collins Scrabble Words:

- Source: <https://github.com/elasticdog/yawl>
- Rebuild: `node scripts/build-en-lexicon.mjs`

It is not official CSW. Verimots is not affiliated with HarperCollins, WESPA,
NASPA, Mattel or Hasbro.

## WGPO Official Words 2024 (WOW24)

The English WOW24 option is generated from the full alphabetical lexicon
published by the Word Game Players Organization:

- Source: <https://wordgameplayers.org/wgpo-official-words/>
- File: <https://wordgameplayers.org/wp-content/uploads/2024/03/FINAL-WOW24-Full-Alphabetical.txt>
- In force: 31 March 2024

Verimots distributes a community copy following WOW24 (2–15 A–Z tiles).
Verimots is not affiliated with WGPO, NASPA, Mattel or Hasbro.

## RLA-ES

The Spanish lexicon is generated from the generic RLA-ES dictionary version 2.9:

- Copyright © 2008–2025 Santiago Bosio and RLA-ES contributors
- Source: <https://github.com/sbosio/rla-es>
- Release: <https://github.com/sbosio/rla-es/releases/tag/v2.9>
- License: Mozilla Public License 1.1

Verimots distributes a transformed word list generated from the dictionary. The
transformation expands valid Hunspell forms, excludes entries with an uppercase
stem (proper names, acronyms and toponyms), keeps words of 2–15 Scrabble tiles
(CH, LL and RR count as one tile in the editions that carry them), removes
stress marks, and preserves Ñ. Words containing K or W are kept for the
North-American tile set and flagged unplayable with the international set.
