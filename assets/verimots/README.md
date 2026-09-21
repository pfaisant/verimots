# Verimots lettering and icons

`LiberationSans-Regular.ttf` is the unmodified Liberation Sans 2.1.5 regular
font. It provides a traditional printed sans letter with flat terminals for
the tile faces and the V in the app icon. It is a visual approximation of
classic word-game tiles, not the proprietary Scrabble typeface.

Source: https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5

Archive: https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz

License: SIL Open Font License 1.1, included in `OFL.txt`.

Run `uv run scripts/build-verimots-brand.py` from the repository root to
regenerate the web/Android tile fonts and all launcher/favicon variants.
The generated Latin subset is named **Verimots Tiles** to respect the
upstream Reserved Font Name. Its glyph outlines are unchanged. The web font
has weight 400; do not synthesize a bold weight on tile letters or points.

The generator takes the V outline from that same font and keeps the cream
tile, green checkmark and palette identical across the game, landing page
and Android icon. Android adaptive and monochrome resources use the same
outline, with launcher-safe insets. Font licenses are also copied alongside
both web fonts and bundled in Android assets.
