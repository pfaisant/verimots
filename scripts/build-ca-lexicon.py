#!/usr/bin/env python3
"""Build Verimots' Catalan game lexicon from the DISC word list.

DISC ("Diccionari Informatitzat de l'Scrabble en Català") is published by Joan
Montané under a dual GPLv3 / CC-BY-SA 3.0 licence, already in Scrabble form:
uppercase, no stress marks, and no K, W or Y outside the NY digraph.

Catalan Scrabble has three multi-character tiles — NY, QU and L·L (ela
geminada) — so a word's tile length is shorter than its character length.
The list is stored in plain orthography and the apps tokenize at load time
('4' = NY, '5' = QU, '6' = L·L; see web/tiles.js and Lexicon.java).

Unlike the Spanish source, DISC needs no game filtering: every entry already
fits 2-15 tiles. The script therefore only verifies the source, checks the
alphabet, and writes the list plus its metadata.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import subprocess
import zipfile
from collections import Counter
from pathlib import Path

DISC_VERSION = "2.18.25"
DISC_URL = "https://diccionari.totescrable.cat/versio/DISC2-LP.zip"
DISC_SHA256 = "c388f3ac86552151329e2593145ea14a5539aa8ae3114ca54ac585e6b7e29e2b"
MEMBER = "DISC2/DISC2-LP.txt"

# Catalan Scrabble alphabet: A-Z without K and W, plus Ç, and Y only inside NY.
# '·' is the interpunct of the L·L tile, never a separator.
WORD_RE = re.compile(r"^[ABCDEFGHIJLMNOPQRSTUVXYZÇ·]{2,}$")

# Longest first: L·L must win over a bare L.
GROUPS = (("L·L", "6"), ("NY", "4"), ("QU", "5"))

MIN_TILES = 2
MAX_TILES = 15


def tokenize(word: str) -> list[str]:
    """Greedy left-to-right split into Catalan tiles, as encoded codes."""
    tiles: list[str] = []
    i = 0
    while i < len(word):
        for sequence, code in GROUPS:
            if word.startswith(sequence, i):
                tiles.append(code)
                i += len(sequence)
                break
        else:
            tiles.append(word[i])
            i += 1
    return tiles


def keep(word: str) -> bool:
    if not WORD_RE.fullmatch(word):
        return False
    # Y and · exist only inside NY and L·L; a stray one means a bad source line.
    if "Y" in word.replace("NY", "") or "·" in word.replace("L·L", ""):
        return False
    return MIN_TILES <= len(tokenize(word)) <= MAX_TILES


def build_meta(words: list[str]) -> dict:
    tiled = [(word, len(tokenize(word))) for word in words]
    by_length = Counter(n for _, n in tiled)
    return {
        "edition": f"DISC {DISC_VERSION}",
        "name": "DISC Catalan word list",
        "inForce": None,
        "until": None,
        "count": len(words),
        "minLen": MIN_TILES,
        "maxLen": MAX_TILES,
        "tiles": 100,
        "byLength": {
            str(length): by_length.get(length, 0)
            for length in range(MIN_TILES, MAX_TILES + 1)
        },
        "letters2": [word for word, n in tiled if n == MIN_TILES],
        "letters3": [word for word, n in tiled if n == 3],
        "source": (
            "DISC (Diccionari Informatitzat de l'Scrabble en Català) "
            f"v{DISC_VERSION} by Joan Montané, redistributed unchanged in "
            "Scrabble form: uppercase, no stress marks, 2 to 15 tiles (NY, QU "
            "and L·L each count as one tile). Dual-licensed GPLv3 / "
            "CC-BY-SA 3.0; not affiliated with FISC, Mattel or Hasbro."
        ),
        "sourceUrl": DISC_URL,
        "sourceSha256": DISC_SHA256,
        "license": "GPL-3.0-or-later OR CC-BY-SA-3.0",
    }


def write_outputs(destination: Path, words: list[str]) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "meta-ca.json").write_text(
        json.dumps(build_meta(words), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    body = ("\n".join(words) + "\n").encode()
    with (destination / "disc-ca.txt.gz").open("wb") as raw:
        with gzip.GzipFile(
            filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0
        ) as zipped:
            zipped.write(body)


def download() -> bytes:
    proc = subprocess.run(["curl", "-fLsS", DISC_URL], check=True, stdout=subprocess.PIPE)
    payload = proc.stdout
    digest = hashlib.sha256(payload).hexdigest()
    if digest != DISC_SHA256:
        raise RuntimeError(
            f"DISC checksum mismatch: {digest}\n"
            "The club publishes a new DISC roughly once a year — check the "
            "version at https://diccionari.totescrable.cat/baixades/ and update "
            "DISC_VERSION / DISC_SHA256 before rebuilding."
        )
    return payload


def build(destination: Path) -> tuple[int, int]:
    payload = download()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        text = archive.read(MEMBER).decode("utf-8")
    words = set()
    rejected = 0
    for line in text.split("\n"):
        word = line.strip()
        if not word:
            continue
        if keep(word):
            words.add(word)
        else:
            rejected += 1
    ordered = sorted(words)
    write_outputs(destination, ordered)
    return len(ordered), rejected


def rebuild_meta_only(destination: Path) -> int:
    """Regenerate meta-ca.json from the existing disc-ca.txt.gz (no network)."""
    with gzip.open(destination / "disc-ca.txt.gz", "rt", encoding="utf-8") as fh:
        words = [line.strip() for line in fh if line.strip()]
    (destination / "meta-ca.json").write_text(
        json.dumps(build_meta(words), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return len(words)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "web" / "data",
    )
    parser.add_argument(
        "--meta-only",
        action="store_true",
        help="regenerate meta-ca.json from the existing word list, no download",
    )
    args = parser.parse_args()
    if args.meta_only:
        count = rebuild_meta_only(args.destination)
        print(f"rebuilt meta for {count} Catalan forms")
        return
    count, rejected = build(args.destination)
    print(f"wrote {count} Catalan forms; rejected {rejected} source lines")


if __name__ == "__main__":
    main()
