package cc.pfa87.ods9;

/**
 * Self-check for EsTiles. Pure JVM — no Android, no gradle, no network:
 *
 *   cd android/ods9 && JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
 *     "$JAVA_HOME/bin/javac" -d /tmp/estiles app/src/main/java/cc/pfa87/ods9/EsTiles.java \
 *       tools/cc/pfa87/ods9/EsTilesCheck.java && "$JAVA_HOME/bin/java" -cp /tmp/estiles cc.pfa87.ods9.EsTilesCheck
 *
 * The numbers live in one place (EsTiles) and are compared against the web's
 * tiles.js by tests/es-tiles-parity.test.mjs. This file checks the behaviour
 * the tables alone cannot: folding, round-trips, scoring, the FISE blank rule.
 */
public final class EsTilesCheck {
    private static int failed;

    public static void main(String[] args) {
        // Bag sizes: the two official sets are 100 and 103 tiles, blanks included.
        eq(sum(EsTiles.bag(EsTiles.FISE)) + 2, 100, "FISE bag is 100 tiles");
        eq(sum(EsTiles.bag(EsTiles.NA)) + 2, 103, "NA bag is 103 tiles");
        eq(EsTiles.alphabet(EsTiles.FISE).length(), EsTiles.values(EsTiles.FISE).length, "FISE values align with the alphabet");
        eq(EsTiles.alphabet(EsTiles.FISE).length(), EsTiles.bag(EsTiles.FISE).length, "FISE bag aligns with the alphabet");
        eq(EsTiles.alphabet(EsTiles.NA).length(), EsTiles.values(EsTiles.NA).length, "NA values align with the alphabet");
        eq(EsTiles.alphabet(EsTiles.NA).length(), EsTiles.bag(EsTiles.NA).length, "NA bag aligns with the alphabet");

        // What made the old model wrong: FISE has no K/W, NA has no CH.
        no(EsTiles.alphabet(EsTiles.FISE).indexOf('K') >= 0, "FISE has no K tile");
        no(EsTiles.alphabet(EsTiles.FISE).indexOf('W') >= 0, "FISE has no W tile");
        ok(EsTiles.alphabet(EsTiles.FISE).indexOf(EsTiles.CH) >= 0, "FISE has a CH tile");
        ok(EsTiles.alphabet(EsTiles.NA).indexOf('K') >= 0, "NA has a K tile");
        ok(EsTiles.alphabet(EsTiles.NA).indexOf('W') >= 0, "NA has a W tile");
        no(EsTiles.alphabet(EsTiles.NA).indexOf(EsTiles.CH) >= 0, "NA has no CH tile");

        // Digraph folding, and the fact that it is edition-dependent.
        eq(EsTiles.encode("CHORRO", EsTiles.FISE), "1O3O", "FISE folds CH and RR");
        eq(EsTiles.encode("CHORRO", EsTiles.NA), "CHO3O", "NA folds RR but not CH");
        eq(EsTiles.encode("LLAVE", EsTiles.FISE), "2AVE", "LL folds in FISE");
        eq(EsTiles.encode("LLAVE", EsTiles.NA), "2AVE", "LL folds in NA too");
        eq(EsTiles.encode("CALLE", EsTiles.FISE), "CA2E", "LL folds mid-word");

        // Tile counts are what a rack and a joker index are measured against.
        eq(EsTiles.encode("CHORRO", EsTiles.FISE).length(), 4, "CHORRO is 4 tiles in FISE");
        eq(EsTiles.encode("CHORRO", EsTiles.NA).length(), 5, "CHORRO is 5 tiles in NA");

        // Scores — the visible symptom of the old model (it gave 11 over 6 tiles).
        eq(score("CHORRO", EsTiles.FISE), 15, "CHORRO scores 15 in FISE");
        eq(score("CHORRO", EsTiles.NA), 16, "CHORRO scores 16 in NA");

        // The separator exists so a real L·L rack survives a round-trip.
        eq(EsTiles.decodeWord("1O3O"), "CHORRO", "decode restores the display form");
        eq(EsTiles.decodeRack("LLAVE", EsTiles.FISE), "L·LAVE", "two L tiles keep a separator");
        eq(EsTiles.encode(EsTiles.decodeRack("LLAVE", EsTiles.FISE), EsTiles.FISE), "LLAVE", "separated rack round-trips");
        eq(EsTiles.encode(EsTiles.decodeRack("2AVE", EsTiles.FISE), EsTiles.FISE), "2AVE", "an LL tile round-trips");
        eq(EsTiles.decodeRack("CH", EsTiles.FISE), "C·H", "C then H keeps a separator in FISE");
        eq(EsTiles.decodeRack("CH", EsTiles.NA), "CH", "no separator needed where CH is not a tile");

        // A typed digit is direct tile entry, and degrades in NA.
        eq(EsTiles.encode("1", EsTiles.FISE), "1", "typed CH is one tile in FISE");
        eq(EsTiles.encode("1", EsTiles.NA), "CH", "typed CH becomes C+H in NA");

        // FISE blanks may not stand for K or W, so those words are unplayable.
        ok(EsTiles.unplayable("KIWI", EsTiles.FISE), "K is unplayable in FISE");
        ok(EsTiles.unplayable("WEB", EsTiles.FISE), "W is unplayable in FISE");
        no(EsTiles.unplayable("KIWI", EsTiles.NA), "K is playable in NA");
        no(EsTiles.unplayable("1O3O", EsTiles.FISE), "an ordinary word is playable");

        // The wire. scripts/ods-game.mjs deals and scores ranked Spanish as FISE
        // and speaks display form, so a player on the NA set must still send and
        // receive FISE — otherwise they are scored against an impossible rack.
        eq(EsTiles.RANKED, EsTiles.FISE, "ranked play is the international set");
        eq(EsTiles.wordToWire("1O3O", "es"), "CHORRO", "words go out as display text");
        eq(EsTiles.wordToWire("HELLO", "en"), "HELLO", "other languages pass through");
        eq(EsTiles.fromWire("CHORRO", "es"), "1O3O", "words come back folded to FISE tiles");
        eq(EsTiles.rackToWire("2AVE", "es"), "LLAVE", "an LL tile goes out as LL");
        eq(EsTiles.rackToWire("LLAVE", "es"), "L·LAVE", "two L tiles keep their separator on the wire");
        eq(EsTiles.fromWire("L·LAVE", "es"), "LLAVE", "and survive the round trip");
        // The NA player's local choice must not leak into a ranked exchange.
        eq(EsTiles.fromWire("CHORRO", "es").length(), 4, "the wire is FISE-encoded whatever the local set");

        eq(EsTiles.normalize("na"), EsTiles.NA, "na normalizes");
        eq(EsTiles.normalize("garbage"), EsTiles.FISE, "anything else falls back to FISE");
        eq(EsTiles.normalize(null), EsTiles.FISE, "null falls back to FISE");

        System.out.println(failed == 0 ? "EsTilesCheck: ok" : "EsTilesCheck: " + failed + " failure(s)");
        if (failed > 0) System.exit(1);
    }

    private static int score(String display, String edition) {
        String enc = EsTiles.encode(display, edition);
        String alpha = EsTiles.alphabet(edition);
        int[] val = EsTiles.values(edition);
        int n = 0;
        for (int i = 0; i < enc.length(); i++) {
            int idx = alpha.indexOf(enc.charAt(i));
            if (idx >= 0) n += val[idx];
        }
        return n;
    }

    private static int sum(int[] a) {
        int n = 0;
        for (int v : a) n += v;
        return n;
    }

    private static void eq(Object actual, Object expected, String what) {
        if (expected.equals(actual)) return;
        failed++;
        System.out.println("  FAIL  " + what + ": expected " + expected + ", got " + actual);
    }

    private static void ok(boolean cond, String what) {
        if (cond) return;
        failed++;
        System.out.println("  FAIL  " + what);
    }

    private static void no(boolean cond, String what) {
        ok(!cond, what);
    }
}
