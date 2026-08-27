#!/usr/bin/env python3
"""Build Verimots' Spanish game lexicon from the generic RLA-ES dictionary.

Spanish Scrabble uses digraph tiles, and there are two official tile sets:

- International (FISE, 100 tiles): CH, LL and RR are single tiles; K and W do
  not exist and a blank may not stand for them.
- North America ("Edición en español", 103 tiles): K and W exist, LL and RR
  are single tiles, but there is no CH tile (C + H are played separately).

The word list stays in plain orthography (CH/LL/RR written out); the apps
tokenize per edition at load time. This script filters by *tile* length
(2–15 tiles in at least one edition) and emits per-edition metadata.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import subprocess
import tempfile
import unicodedata
from collections import Counter
from pathlib import Path

RLA_VERSION = "2.9"
RLA_URL = f"https://github.com/sbosio/rla-es/releases/download/v{RLA_VERSION}/es.oxt"
RLA_SHA256 = "b08a1a0e3e044697f63a67184f591f7e2c37bbb53bbfbb4780bcbd84929d6e8c"
# Character bound only — the real 2–15 bound is applied per edition in tiles.
WORD_RE = re.compile(r"^[A-ZÑ]{2,17}$")

FISE_DIGRAPHS = ("CH", "LL", "RR")
NA_DIGRAPHS = ("LL", "RR")


def tokenize(word: str, digraphs: tuple[str, ...]) -> list[str]:
    """Greedy left-to-right split into edition tiles."""
    tiles: list[str] = []
    i = 0
    while i < len(word):
        pair = word[i : i + 2]
        if pair in digraphs:
            tiles.append(pair)
            i += 2
        else:
            tiles.append(word[i])
            i += 1
    return tiles


def edition_block(words: list[str], digraphs: tuple[str, ...], allow_kw: bool) -> dict:
    playable = []
    for word in words:
        if not allow_kw and ("K" in word or "W" in word):
            continue
        n = len(tokenize(word, digraphs))
        if 2 <= n <= 15:
            playable.append((word, n))
    by_length = Counter(n for _, n in playable)
    return {
        "count": len(playable),
        "byLength": {str(length): by_length.get(length, 0) for length in range(2, 16)},
        "letters2": [w for w, n in playable if n == 2],
        "letters3": [w for w, n in playable if n == 3],
    }


def build_meta(words: list[str]) -> dict:
    fise = edition_block(words, FISE_DIGRAPHS, allow_kw=False)
    na = edition_block(words, NA_DIGRAPHS, allow_kw=True)
    return {
        "edition": f"RLA-ES {RLA_VERSION}",
        "name": "RLA-ES Spanish word list",
        "inForce": None,
        "until": None,
        # Legacy top-level fields mirror the international (FISE) edition.
        "count": len(words),
        "minLen": 2,
        "maxLen": 15,
        "byLength": fise["byLength"],
        "letters2": fise["letters2"],
        "letters3": fise["letters3"],
        "editions": {
            "fise": {"tiles": 100, **fise},
            "na": {"tiles": 103, **na},
        },
        "source": (
            "RLA-ES generic Spanish dictionary v2.9, game-filtered to lowercase "
            "common forms of 2 to 15 tiles (CH, LL and RR count as one tile in "
            "the editions that carry them). Stress marks are ignored and Ñ is "
            "preserved. Licensed under MPL 1.1; not affiliated with FILE, FISE, "
            "Mattel or Hasbro."
        ),
        "sourceUrl": RLA_URL,
        "sourceSha256": RLA_SHA256,
        "license": "MPL-1.1",
    }


def keep(word: str) -> bool:
    """Keep a word when it is playable (2–15 tiles) in at least one edition."""
    if not WORD_RE.fullmatch(word):
        return False
    fise_ok = ("K" not in word and "W" not in word) and (
        2 <= len(tokenize(word, FISE_DIGRAPHS)) <= 15
    )
    na_ok = 2 <= len(tokenize(word, NA_DIGRAPHS)) <= 15
    return fise_ok or na_ok


def write_outputs(destination: Path, words: list[str]) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "meta-es.json").write_text(
        json.dumps(build_meta(words), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    body = ("\n".join(words) + "\n").encode()
    with (destination / "rla-es.txt.gz").open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as zipped:
            zipped.write(body)


def unmunch(word, aff):
    """Expand one Hunspell stem using Spylls' reference unmunch algorithm."""
    result = set()
    if aff.FORBIDDENWORD and aff.FORBIDDENWORD in word.flags:
        return result
    if not (aff.NEEDAFFIX and aff.NEEDAFFIX in word.flags):
        result.add(word.stem)

    suffixes = [
        suffix
        for flag in word.flags
        for suffix in aff.SFX.get(flag, [])
        if suffix.cond_regexp.search(word.stem)
    ]
    prefixes = [
        prefix
        for flag in word.flags
        for prefix in aff.PFX.get(flag, [])
        if prefix.cond_regexp.search(word.stem)
    ]

    for suffix in suffixes:
        root = word.stem[: -len(suffix.strip)] if suffix.strip else word.stem
        suffixed = root + suffix.add
        if not (aff.NEEDAFFIX and aff.NEEDAFFIX in suffix.flags):
            result.add(suffixed)
        for suffix2 in (
            candidate
            for flag in suffix.flags
            for candidate in aff.SFX.get(flag, [])
            if candidate.cond_regexp.search(suffixed)
        ):
            root = suffixed[: -len(suffix2.strip)] if suffix2.strip else suffixed
            result.add(root + suffix2.add)

    for prefix in prefixes:
        root = word.stem[len(prefix.strip) :]
        prefixed = prefix.add + root
        if not (aff.NEEDAFFIX and aff.NEEDAFFIX in prefix.flags):
            result.add(prefixed)
        if not prefix.crossproduct:
            continue
        additional = [
            suffix
            for flag in prefix.flags
            for suffix in aff.SFX.get(flag, [])
            if suffix.crossproduct
            and suffix not in suffixes
            and suffix.cond_regexp.search(prefixed)
        ]
        for suffix in suffixes + additional:
            root = prefixed[: -len(suffix.strip)] if suffix.strip else prefixed
            suffixed = root + suffix.add
            result.add(suffixed)
            for suffix2 in (
                candidate
                for flag in suffix.flags
                for candidate in aff.SFX.get(flag, [])
                if candidate.crossproduct and candidate.cond_regexp.search(suffixed)
            ):
                root = suffixed[: -len(suffix2.strip)] if suffix2.strip else suffixed
                result.add(root + suffix2.add)
    return result


def tile_form(value: str) -> str:
    """Remove Spanish stress marks while preserving Ñ as a distinct letter."""
    sentinel = ""
    folded = value.replace("ñ", sentinel).replace("Ñ", sentinel)
    folded = "".join(
        ch for ch in unicodedata.normalize("NFD", folded) if unicodedata.category(ch) != "Mn"
    )
    return folded.replace(sentinel, "Ñ").upper()


def download() -> bytes:
    proc = subprocess.run(
        ["curl", "-fLsS", RLA_URL],
        check=True,
        stdout=subprocess.PIPE,
    )
    payload = proc.stdout
    digest = hashlib.sha256(payload).hexdigest()
    if digest != RLA_SHA256:
        raise RuntimeError(f"RLA-ES checksum mismatch: {digest}")
    return payload


def build(destination: Path) -> tuple[int, int]:
    from spylls.hunspell.dictionary import Dictionary

    payload = download()
    with tempfile.TemporaryDirectory(prefix="verimots-es-") as directory:
        root = Path(directory)
        with zipfile_open(payload) as archive:
            for name in ("es.aff", "es.dic"):
                (root / name).write_bytes(archive.read(name))
        dictionary = Dictionary.from_files(str(root / "es"))

        words: set[str] = set()
        rejected = 0
        for entry in dictionary.dic.words:
            # RLA-ES intentionally includes proper names, acronyms and toponyms.
            # Verimots follows word-game rules and keeps lowercase common stems.
            if not entry.stem or not entry.stem[0].islower():
                continue
            for form in unmunch(entry, dictionary.aff):
                if not dictionary.lookup(form):
                    rejected += 1
                    continue
                normalized = tile_form(form)
                if keep(normalized):
                    words.add(normalized)

    ordered = sorted(words)
    write_outputs(destination, ordered)
    return len(ordered), rejected


def zipfile_open(payload: bytes):
    import zipfile

    return zipfile.ZipFile(io.BytesIO(payload))


def rebuild_meta_only(destination: Path) -> int:
    """Regenerate meta-es.json from the existing rla-es.txt.gz (no network)."""
    with gzip.open(destination / "rla-es.txt.gz", "rt", encoding="utf-8") as fh:
        words = [line.strip() for line in fh if line.strip()]
    (destination / "meta-es.json").write_text(
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
        help="regenerate meta-es.json from the existing word list, no download",
    )
    args = parser.parse_args()
    if args.meta_only:
        count = rebuild_meta_only(args.destination)
        print(f"rebuilt meta for {count} Spanish forms")
        return
    count, rejected = build(args.destination)
    print(f"wrote {count} Spanish forms; rejected {rejected} invalid expansions")


if __name__ == "__main__":
    main()
