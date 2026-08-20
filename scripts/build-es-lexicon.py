#!/usr/bin/env python3
"""Build Verimots' Spanish game lexicon from the generic RLA-ES dictionary."""

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
import zipfile
from collections import Counter
from pathlib import Path

from spylls.hunspell.dictionary import Dictionary

RLA_VERSION = "2.9"
RLA_URL = f"https://github.com/sbosio/rla-es/releases/download/v{RLA_VERSION}/es.oxt"
RLA_SHA256 = "b08a1a0e3e044697f63a67184f591f7e2c37bbb53bbfbb4780bcbd84929d6e8c"
WORD_RE = re.compile(r"^[A-ZÑ]{2,15}$")


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
    """Remove Spanish stress marks while preserving Ñ as a distinct tile."""
    sentinel = "\ue000"
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
    payload = download()
    with tempfile.TemporaryDirectory(prefix="verimots-es-") as directory:
        root = Path(directory)
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
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
                if WORD_RE.fullmatch(normalized):
                    words.add(normalized)

    ordered = sorted(words)
    by_length = Counter(map(len, ordered))
    metadata = {
        "edition": f"RLA-ES {RLA_VERSION}",
        "name": "RLA-ES Spanish word list",
        "inForce": None,
        "until": None,
        "count": len(ordered),
        "minLen": 2,
        "maxLen": 15,
        "byLength": {str(length): by_length[length] for length in range(2, 16)},
        "letters2": [word for word in ordered if len(word) == 2],
        "letters3": [word for word in ordered if len(word) == 3],
        "source": (
            "RLA-ES generic Spanish dictionary v2.9, game-filtered to lowercase "
            "common forms of 2 to 15 single-letter tiles. Stress marks are ignored "
            "and Ñ is preserved. Licensed under MPL 1.1; not affiliated with FILE, "
            "FISE, Mattel or Hasbro."
        ),
        "sourceUrl": RLA_URL,
        "sourceSha256": RLA_SHA256,
        "license": "MPL-1.1",
    }
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "meta-es.json").write_text(
        json.dumps(metadata, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    body = ("\n".join(ordered) + "\n").encode()
    with (destination / "rla-es.txt.gz").open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as zipped:
            zipped.write(body)
    return len(ordered), rejected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "web" / "data",
    )
    args = parser.parse_args()
    count, rejected = build(args.destination)
    print(f"wrote {count} Spanish forms; rejected {rejected} invalid expansions")


if __name__ == "__main__":
    main()
