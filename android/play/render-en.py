#!/usr/bin/env python3
"""Render English Play listing graphics and screenshots."""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
EN = ROOT / "en"
ASSETS = Path.home() / ".cursor/projects/Users-paulfaisant-Dev-Verimots/assets"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MOCKUPS = ROOT / "mockups" / "en"

SHOTS = [
    ("phone-01-check.html", "phone-01-check.png", 1080, 1920),
    ("phone-02-rack.html", "phone-02-rack.png", 1080, 1920),
    ("phone-03-challenge.html", "phone-03-challenge.png", 1080, 1920),
    ("phone-04-board.html", "phone-04-board.png", 1080, 1920),
    ("tablet7-01-check.html", "tablet7-01-check.png", 1200, 1920),
    ("tablet7-02-challenge.html", "tablet7-02-challenge.png", 1200, 1920),
    ("tablet10-01-check.html", "tablet10-01-check.png", 1920, 1200),
    ("tablet10-02-challenge.html", "tablet10-02-challenge.png", 1920, 1200),
]


def flatten_resize(src: Path, dest: Path, size: tuple[int, int], crop: bool = False) -> None:
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGB", im.size, (14, 23, 17))
    bg.paste(im, mask=im.split()[-1])
    if crop:
        tw, th = size
        sw, sh = bg.size
        target_ratio = tw / th
        src_ratio = sw / sh
        if src_ratio > target_ratio:
            nw = int(sh * target_ratio)
            left = (sw - nw) // 2
            bg = bg.crop((left, 0, left + nw, sh))
        else:
            nh = int(sw / target_ratio)
            top = (sh - nh) // 2
            bg = bg.crop((0, top, sw, top + nh))
    out = bg.resize(size, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG", optimize=True)
    print(f"wrote {dest.name} {out.size} {dest.stat().st_size}B")


def screenshot(html: Path, dest: Path, width: int, height: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--window-size={width},{height}",
        f"--screenshot={dest}",
        html.resolve().as_uri(),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    im = Image.open(dest).convert("RGB")
    if im.size != (width, height):
        im = im.resize((width, height), Image.Resampling.LANCZOS)
    im.save(dest, "PNG", optimize=True)
    print(f"shot {dest.name} {im.size} {dest.stat().st_size}B")


def main() -> None:
    flatten_resize(
        ASSETS / "verimots-feature-en-source.png",
        EN / "feature-1024x500.png",
        (1024, 500),
        crop=True,
    )
    for html_name, png_name, w, h in SHOTS:
        screenshot(MOCKUPS / html_name, EN / png_name, w, h)


if __name__ == "__main__":
    main()
