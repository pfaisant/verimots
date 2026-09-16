package cc.pfa87.ods9;

/**
 * Spanish tile model — the Java side of dashboard/s/tiles.js.
 *
 * Spanish Scrabble has digraph tiles, and two official sets exist:
 *
 * - FISE (international, 100 tiles): CH, LL, RR are single tiles; K and W do
 *   not exist and a blank may not stand for them, so a word containing K or W
 *   stays valid in the word list but can never be placed.
 * - NA ("Edición en español", 103 tiles): K and W exist, LL and RR are single
 *   tiles, but there is no CH tile.
 *
 * Internally a word or rack is an ENCODED string: one char per TILE, with the
 * digraphs folded to digits — '1' = CH, '2' = LL, '3' = RR. Every length,
 * index, joker position and shuffle then stays tile-correct. Display strings
 * are the decoded form ("CHORRO"); a rack may carry a '·' separator to stop
 * two single tiles (L·L) merging into a digraph when re-encoded.
 *
 * The app used to model Spanish as 27 plain letters including K and W, which
 * was neither official set: CHORRO scored 11 over 6 tiles here and 15 over 4
 * on the web. The tables below are transcribed from tileSpec('es', …) so the
 * two platforms score the same word the same way — EsTilesCheck asserts it.
 */
final class EsTiles {
    static final String FISE = "fise";
    static final String NA = "na";
    static final char TILE_SEP = '·';

    static final char CH = '1';
    static final char LL = '2';
    static final char RR = '3';

    // Tile order is the web's ORDER_FISE / ORDER_NA; values and bag counts are
    // positional against it, so a row never drifts out of step with a letter.
    private static final String ORDER_FISE = "ABC1DEFGHIJL2MNÑOPQR3STUVXYZ";
    private static final int[] VAL_FISE = {
        1, 3, 3, 5, 2, 1, 4, 2, 4, 1, 8, 1, 8, 3, 1, 8, 1, 3, 5, 1, 8, 1, 1, 1, 4, 8, 4, 10
    };
    // 98 letter tiles + 2 blanks = 100.
    private static final int[] BAG_FISE = {
        12, 2, 4, 1, 5, 12, 1, 2, 2, 6, 1, 4, 1, 2, 5, 1, 9, 2, 1, 5, 1, 6, 4, 5, 1, 1, 1, 1
    };
    private static final String HARD_FISE = "1J2ÑQ3XYZ";

    private static final String ORDER_NA = "ABCDEFGHIJKL2MNÑOPQR3STUVWXYZ";
    private static final int[] VAL_NA = {
        1, 3, 2, 2, 1, 4, 2, 4, 1, 6, 8, 1, 8, 3, 1, 8, 1, 3, 8, 1, 8, 1, 1, 1, 4, 8, 8, 4, 10
    };
    // 101 letter tiles + 2 blanks = 103.
    private static final int[] BAG_NA = {
        11, 3, 4, 4, 11, 2, 2, 2, 6, 2, 1, 4, 1, 3, 5, 1, 8, 2, 1, 4, 1, 7, 4, 6, 2, 1, 1, 1, 1
    };
    private static final String HARD_NA = "JK2ÑQ3WXYZ";

    private EsTiles() {}

    static String normalize(String edition) {
        return NA.equals(edition) ? NA : FISE;
    }

    static boolean isNa(String edition) {
        return NA.equals(normalize(edition));
    }

    /** Encoded alphabet for an edition — one char per distinct tile. */
    static String alphabet(String edition) {
        return isNa(edition) ? ORDER_NA : ORDER_FISE;
    }

    static int[] values(String edition) {
        return isNa(edition) ? VAL_NA : VAL_FISE;
    }

    static int[] bag(String edition) {
        return isNa(edition) ? BAG_NA : BAG_FISE;
    }

    static String hardTiles(String edition) {
        return isNa(edition) ? HARD_NA : HARD_FISE;
    }

    /** Display glyph of one tile code: '1' → "CH". */
    static String glyph(char code) {
        if (code == CH) return "CH";
        if (code == LL) return "LL";
        if (code == RR) return "RR";
        return String.valueOf(code);
    }

    static boolean isDigraph(char code) {
        return code == CH || code == LL || code == RR;
    }

    private static boolean separator(char ch) {
        return ch == TILE_SEP || ch == '-' || ch == ' ' || ch == ',' || ch == '/' || ch == '\'';
    }

    /**
     * The second letter that folds a digraph, or 0 when this letter starts none
     * in this edition. NA has no CH tile, so C never folds there.
     */
    private static char foldsWith(char first, String edition) {
        if (first == 'C') return isNa(edition) ? 0 : 'H';
        if (first == 'L') return 'L';
        if (first == 'R') return 'R';
        return 0;
    }

    private static char foldedCode(char first) {
        if (first == 'C') return CH;
        if (first == 'L') return LL;
        return RR;
    }

    /**
     * Display → encoded. Input is an uppercased display string; separators are
     * dropped, and a typed '1'/'2'/'3' is direct tile entry (in NA a typed '1'
     * becomes plain C + H, because that edition has no CH tile).
     */
    static String encode(String raw, String edition) {
        String s = raw == null ? "" : raw;
        StringBuilder out = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (separator(ch)) continue;
            if (ch == CH) {
                out.append(isNa(edition) ? "CH" : String.valueOf(CH));
                continue;
            }
            if (ch == LL || ch == RR) {
                out.append(ch);
                continue;
            }
            if (ch >= '0' && ch <= '9') continue;
            char second = foldsWith(ch, edition);
            if (second != 0 && i + 1 < s.length() && s.charAt(i + 1) == second) {
                out.append(foldedCode(ch));
                i++;
                continue;
            }
            out.append(ch);
        }
        return out.toString();
    }

    /** Encoded → display word: "1O3O" → "CHORRO". */
    static String decodeWord(String encoded) {
        String s = encoded == null ? "" : encoded;
        StringBuilder out = new StringBuilder(s.length() + 4);
        for (int i = 0; i < s.length(); i++) out.append(glyph(s.charAt(i)));
        return out.toString();
    }

    /**
     * Encoded rack → display, inserting '·' wherever two adjacent single tiles
     * would otherwise merge back into a digraph, so encode(decodeRack(x)) == x.
     */
    static String decodeRack(String encoded, String edition) {
        String s = encoded == null ? "" : encoded;
        StringBuilder out = new StringBuilder(s.length() + 4);
        for (int i = 0; i < s.length(); i++) {
            String g = glyph(s.charAt(i));
            if (out.length() > 0) {
                char prev = out.charAt(out.length() - 1);
                char second = foldsWith(prev, edition);
                if (second != 0 && g.charAt(0) == second) out.append(TILE_SEP);
            }
            out.append(g);
        }
        return out.toString();
    }

    /**
     * The tile set the server plays by. scripts/ods-game.mjs says it outright:
     * ranked Spanish is always the international 100-tile set, and words and
     * racks cross HTTP in DISPLAY form ("CHORRO", racks separated with '·').
     * So the wire is converted here, against FISE, never against whatever the
     * player happens to have chosen locally — otherwise a player on the
     * North-American set would be scored against a rack they cannot hold.
     */
    static final String RANKED = FISE;

    /** Encoded tiles → the display form the server expects. */
    static String wordToWire(String encoded, String lang) {
        return "es".equals(lang) ? decodeWord(encoded) : String.valueOf(encoded == null ? "" : encoded);
    }

    static String rackToWire(String encoded, String lang) {
        return "es".equals(lang) ? decodeRack(encoded, RANKED) : String.valueOf(encoded == null ? "" : encoded);
    }

    /** Display form off the wire → encoded tiles, against the ranked set. */
    static String fromWire(String display, String lang) {
        return "es".equals(lang) ? encode(display, RANKED) : String.valueOf(display == null ? "" : display);
    }

    /**
     * True when this word can never be placed with this tile set: the FISE bag
     * has no K or W and its blanks may not represent them. Such words stay
     * checkable but must be kept out of racks, deals and anagram results.
     */
    static boolean unplayable(String encoded, String edition) {
        if (isNa(edition)) return false;
        String s = encoded == null ? "" : encoded;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == 'K' || c == 'W') return true;
        }
        return false;
    }
}
