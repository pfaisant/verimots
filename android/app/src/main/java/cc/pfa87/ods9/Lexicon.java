package cc.pfa87.ods9;

import android.content.Context;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.TimeZone;
import java.util.zip.GZIPInputStream;

/**
 * Word list + tile model. Internally every word and rack is a tile-encoded
 * string: one char per tile. Spanish digraphs are folded to digits —
 * '1' = CH, '2' = LL, '3' = RR — so lengths, joker indexes and shuffles stay
 * tile-correct; {@link #display} turns them back into letters for the UI.
 *
 * Two Spanish tile sets exist: international FISE (100 tiles, CH/LL/RR, no
 * K/W, a blank may not stand for K/W) and North America (103 tiles, K/W,
 * LL/RR but no CH tile). See {@link Dict#esEdition}.
 */
public final class Lexicon {
    public static final char CH = '1';
    public static final char LL = '2';
    public static final char RR = '3';
    public static final char SEP = '·';
    private static final String ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ123";
    //                                      A  B  C  D  E   F  G  H  I  J  K   L  M  N  Ñ  O  P  Q   R  S  T  U  V  W   X   Y   Z   CH LL RR
    public static final int[] VAL = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 10, 1, 2, 1, 0, 1, 3, 8, 1, 1, 1, 1, 4, 10, 10, 10, 10, 0, 0, 0
    };
    private static final int[] VAL_EN = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 0, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10, 0, 0, 0
    };
    /** International (FISE): no K/W tiles; CH 5, LL 8, RR 8. */
    private static final int[] VAL_ES = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 0, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 4, 0, 8, 4, 10, 5, 8, 8
    };
    /** North America: K/W 8, J 6, C 2, Q 8; no CH tile. */
    private static final int[] VAL_ES_NA = {
        1, 3, 2, 2, 1, 4, 2, 4, 1, 6, 8, 1, 3, 1, 8, 1, 3, 8, 1, 1, 1, 1, 4, 8, 8, 4, 10, 0, 8, 8
    };
    private static final int[] BAG = {
        9, 2, 2, 3, 15, 2, 2, 2, 8, 1, 1, 5, 3, 6, 0, 6, 2, 1, 6, 6, 6, 6, 2, 1, 1, 1, 1, 0, 0, 0
    };
    private static final int[] BAG_EN = {
        9, 2, 2, 4, 12, 2, 3, 2, 9, 1, 1, 4, 2, 6, 0, 8, 2, 1, 6, 4, 6, 4, 2, 2, 1, 2, 1, 0, 0, 0
    };
    /** 98 letter tiles + 2 blanks = 100. */
    private static final int[] BAG_ES = {
        12, 2, 4, 5, 12, 1, 2, 2, 6, 1, 0, 4, 2, 5, 1, 9, 2, 1, 5, 6, 4, 5, 1, 0, 1, 1, 1, 1, 1, 1
    };
    /** 101 letter tiles + 2 blanks = 103. */
    private static final int[] BAG_ES_NA = {
        11, 3, 4, 4, 11, 2, 2, 2, 6, 2, 1, 4, 3, 5, 1, 8, 2, 1, 4, 7, 4, 6, 2, 1, 1, 1, 1, 0, 1, 1
    };
    private static final String HARD_DEFAULT = "JKÑQWXYZ";
    private static final String HARD_ES = "JÑQXYZ123";
    private static final String HARD_ES_NA = "JKÑQWXYZ23";

    public static final class Play {
        public final String word;
        public final int score;
        public final int[] jokers;

        Play(String word, int score, int[] jokers) {
            this.word = word;
            this.score = score;
            this.jokers = jokers;
        }

        public int pts() {
            return score + (word.length() == 7 ? 50 : 0);
        }
    }

    public static final class Deal {
        public final String category;
        public final String rack;
        public final List<Play> catalog;

        public final String seed;
        public final int bonusIndex;

        Deal(String category, String rack, List<Play> catalog) {
            this(category, rack, catalog, "", -1);
        }

        Deal(String category, String rack, List<Play> catalog, String seed) {
            this(category, rack, catalog, seed, -1);
        }

        Deal(String category, String rack, List<Play> catalog, String seed, int bonusIndex) {
            this.category = category;
            this.rack = rack;
            this.catalog = catalog;
            this.seed = seed == null ? "" : seed;
            this.bonusIndex = bonusIndex;
        }
    }

    private static Lexicon instance;
    private final String lang;
    private final String dict;
    private final String edition;
    private final boolean chTile;
    private final int[] val;
    private final int[] bag;
    private final boolean[] hardMask = new boolean[ALPHABET.length()];
    private final HashSet<String> set = new HashSet<>();
    @SuppressWarnings("unchecked")
    private final ArrayList<String>[] byLen = new ArrayList[16];
    private final Random rng = new Random();
    private int count;
    private ArrayList<String> bingo;
    private ArrayList<String> bingoRich;
    private ArrayList<String> longWords;
    private ArrayList<String> longRich;
    private ArrayList<String> hard;

    public static synchronized Lexicon get(Context ctx) throws IOException {
        return get(ctx, Dict.get(ctx));
    }

    public static synchronized Lexicon get(Context ctx, String dictOrLang) throws IOException {
        return get(ctx, dictOrLang, null);
    }

    /** editionOverride forces a Spanish tile set (ranked play is always FISE). */
    public static synchronized Lexicon get(Context ctx, String dictOrLang, String editionOverride) throws IOException {
        String dict = Dict.normalize(dictOrLang);
        if (dict.isEmpty()) dict = Dict.defaultFor(dictOrLang);
        String wanted = Dict.langOf(dict);
        String edition = !Lang.ES.equals(wanted) ? Dict.ES_FISE
                : editionOverride != null ? editionOverride : Dict.esEdition(ctx);
        if (instance == null || !wanted.equals(instance.lang) || !dict.equals(instance.dict)
                || !edition.equals(instance.edition)) {
            instance = new Lexicon(ctx.getApplicationContext(), wanted, dict, edition);
        }
        return instance;
    }

    public String edition() {
        return edition;
    }

    public static synchronized boolean ready() {
        return instance != null;
    }

    private Lexicon(Context ctx, String lang, String dict, String edition) throws IOException {
        this.lang = lang;
        this.dict = dict;
        this.edition = edition;
        boolean es = "es".equals(lang);
        boolean na = es && Dict.ES_NA.equals(edition);
        this.chTile = es && !na;
        this.val = "en".equals(lang) ? VAL_EN : na ? VAL_ES_NA : es ? VAL_ES : VAL;
        this.bag = "en".equals(lang) ? BAG_EN : na ? BAG_ES_NA : es ? BAG_ES : BAG;
        String hardSet = na ? HARD_ES_NA : es ? HARD_ES : HARD_DEFAULT;
        for (int i = 0; i < hardSet.length(); i++) hardMask[letterIndex(hardSet.charAt(i))] = true;
        for (int i = 0; i < byLen.length; i++) byLen[i] = new ArrayList<>();
        InputStream raw = openLexicon(ctx, dict);
        try (BufferedReader r = new BufferedReader(new InputStreamReader(raw, StandardCharsets.UTF_8), 64 * 1024)) {
            String line;
            while ((line = r.readLine()) != null) {
                if (line.isEmpty()) continue;
                String word = es ? encode(line, chTile) : line;
                if (word.length() < 2 || word.length() > 15) continue;
                set.add(word);
                count++;
                // FISE has no K/W tiles and a blank may not stand for them: such
                // words stay checkable but never enter racks, deals or anagrams.
                if (!unplayable(word)) byLen[word.length()].add(word);
            }
        }
        buildPools();
    }

    /** True when the tile set cannot place this word at all (K/W under FISE). */
    public boolean unplayable(String word) {
        if (!chTile) return false;
        return word.indexOf('K') >= 0 || word.indexOf('W') >= 0;
    }

    /**
     * Display → encoded. Greedy CH/LL/RR folding (LL/RR only without a CH
     * tile); a separator keeps two single tiles apart (L·L); digits 1/2/3
     * type a digraph directly.
     */
    static String encode(String display, boolean chTile) {
        StringBuilder out = new StringBuilder(display.length());
        int n = display.length();
        for (int i = 0; i < n; i++) {
            char c = display.charAt(i);
            if (c == SEP || c == '-' || c == ' ' || c == ',' || c == '/') continue;
            if (c == '1') {
                if (chTile) out.append(CH);
                else out.append("CH");
                continue;
            }
            if (c == '2' || c == '3') {
                out.append(c);
                continue;
            }
            char next = i + 1 < n ? display.charAt(i + 1) : 0;
            if (chTile && c == 'C' && next == 'H') {
                out.append(CH);
                i++;
            } else if (c == 'L' && next == 'L') {
                out.append(LL);
                i++;
            } else if (c == 'R' && next == 'R') {
                out.append(RR);
                i++;
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    /** Glyph shown on one tile ('1' → "CH"). */
    public static String tileGlyph(char code) {
        if (code == CH) return "CH";
        if (code == LL) return "LL";
        if (code == RR) return "RR";
        return String.valueOf(code);
    }

    /** Encoded → display word ("1O3O" → "CHORRO"). */
    public static String display(String encoded) {
        if (encoded == null) return "";
        StringBuilder b = new StringBuilder(encoded.length() + 4);
        for (int i = 0; i < encoded.length(); i++) b.append(tileGlyph(encoded.charAt(i)));
        return b.toString();
    }

    /**
     * Encoded rack → display with a '·' wherever two adjacent single tiles
     * would otherwise re-merge into a digraph (L,L → "L·L").
     */
    public String displayRack(String encoded) {
        if (encoded == null) return "";
        StringBuilder b = new StringBuilder(encoded.length() + 6);
        for (int i = 0; i < encoded.length(); i++) {
            String glyph = tileGlyph(encoded.charAt(i));
            if (b.length() > 0) {
                char prev = b.charAt(b.length() - 1);
                char first = glyph.charAt(0);
                boolean merges = (prev == 'L' && first == 'L') || (prev == 'R' && first == 'R')
                        || (chTile && prev == 'C' && first == 'H');
                if (merges) b.append(SEP);
            }
            b.append(glyph);
        }
        return b.toString();
    }

    /** Static convenience: the loaded lexicon's rack rendering, else plain display. */
    public static String displayRackOf(String encoded) {
        return instance != null ? instance.displayRack(encoded) : display(encoded);
    }

    private static InputStream openLexicon(Context ctx, String dict) throws IOException {
        String gz = Dict.CSW.equals(dict) ? "data/yawl.txt.gz"
                : Dict.WOW24.equals(dict) ? "data/wow24.txt.gz"
                : Dict.RLA.equals(dict) ? "data/rla-es.txt.gz" : "data/ods9.txt.gz";
        String plain = Dict.CSW.equals(dict) ? "data/yawl.txt"
                : Dict.WOW24.equals(dict) ? "data/wow24.txt"
                : Dict.RLA.equals(dict) ? "data/rla-es.txt" : "data/ods9.txt";
        try {
            return new GZIPInputStream(ctx.getAssets().open(gz));
        } catch (IOException e) {
            return ctx.getAssets().open(plain);
        }
    }

    public int size() {
        return count;
    }

    public List<String> wordsOfLength(int len) {
        if (len < 0 || len >= byLen.length) return Collections.emptyList();
        return new ArrayList<>(byLen[len]);
    }

    public static List<String> dailyStudySlice(List<String> words, int year, int month, int day, int size) {
        if (words == null || words.isEmpty() || size <= 0) return Collections.emptyList();
        int take = Math.min(size, words.size());
        Calendar utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        utc.clear();
        utc.set(year, month, day);
        int start = Math.floorMod((int) (utc.getTimeInMillis() / 86_400_000L), words.size());
        ArrayList<String> out = new ArrayList<>(take);
        for (int i = 0; i < take; i++) out.add(words.get((start + i) % words.size()));
        return out;
    }

    public static String joinWords(List<String> words) {
        if (words == null || words.isEmpty()) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < words.size(); i++) {
            if (i > 0) b.append(" · ");
            b.append(display(words.get(i)));
        }
        return b.toString();
    }

    public boolean has(String word) {
        return set.contains(word);
    }

    public List<String> find(String mode, String query, int limit) {
        ArrayList<String> out = new ArrayList<>();
        if (query == null || query.length() < 1) return out;
        int cap = Math.max(1, limit);
        for (int len = 2; len < byLen.length && out.size() < cap; len++) {
            for (String w : byLen[len]) {
                boolean hit = false;
                if ("prefix".equals(mode)) hit = w.startsWith(query);
                else if ("suffix".equals(mode)) hit = w.endsWith(query);
                else if ("has".equals(mode)) hit = w.contains(query);
                if (!hit) continue;
                out.add(w);
                if (out.size() >= cap) break;
            }
        }
        return out;
    }

    private static int letterIndex(char ch) {
        return ALPHABET.indexOf(ch);
    }

    public static int letterScore(char ch) {
        int index = letterIndex(ch);
        if (index < 0) return 0;
        int[] table = instance != null ? instance.val : VAL;
        return table[index];
    }

    private int points(String word, Set<Integer> jokers) {
        int n = 0;
        for (int i = 0; i < word.length(); i++) {
            if (jokers != null && jokers.contains(i)) continue;
            char ch = word.charAt(i);
            int index = letterIndex(ch);
            if (index >= 0) n += val[index];
        }
        return n;
    }

    public int score(String word, Set<Integer> jokers) {
        return points(word, jokers);
    }

    /** Word of the day: deterministic for a given key (Paris date + list),
     *  5–8 letters and worth at least 9 points so there is something to read. */
    private ArrayList<String> discoverPool;

    private ArrayList<String> discoverPool() {
        if (discoverPool != null) return discoverPool;
        ArrayList<String> pool = new ArrayList<>();
        for (int len = 5; len <= 8 && len < byLen.length; len++) {
            for (String w : byLen[len]) if (scoreWord(w, null) >= 9) pool.add(w);
        }
        discoverPool = pool;
        return pool;
    }

    /** A random word to discover (5–8 letters, ≥ 9 points). */
    public String randomWord() {
        ArrayList<String> pool = discoverPool();
        if (pool.isEmpty()) return null;
        return pool.get(rng.nextInt(pool.size()));
    }

    public String dailyWord(String key) {
        ArrayList<String> pool = discoverPool();
        if (pool.isEmpty()) return null;
        int h = 0x811c9dc5;
        for (int i = 0; i < key.length(); i++) {
            h ^= key.charAt(i);
            h *= 16777619;
        }
        int idx = (int) ((h & 0xffffffffL) % pool.size());
        return pool.get(idx);
    }

    public static int scoreWord(String word, Set<Integer> jokers) {
        if (instance != null) return instance.points(word, jokers);
        int n = 0;
        for (int i = 0; i < word.length(); i++) {
            if (jokers != null && jokers.contains(i)) continue;
            n += letterScore(word.charAt(i));
        }
        return n;
    }

    public static String normalize(String raw) {
        return normalize(raw, false);
    }

    public static String normalizeRack(String raw) {
        return normalize(raw, true);
    }

    private static String normalize(String raw, boolean keepBlanks) {
        boolean es = instance != null && "es".equals(instance.lang);
        String composed = java.text.Normalizer.normalize(
                String.valueOf(raw == null ? "" : raw),
                java.text.Normalizer.Form.NFC);
        String protectedRaw = composed
                .replace('ñ', '\uE000')
                .replace('Ñ', '\uE000');
        String s = java.text.Normalizer.normalize(protectedRaw, java.text.Normalizer.Form.NFD);
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '\u0300' && c <= '\u036f') continue;
            if (c == '\uE000') {
                b.append('Ñ');
                continue;
            }
            if (c >= 'a' && c <= 'z') c = (char) (c - 32);
            if (c >= 'A' && c <= 'Z' || c == 'Ñ') b.append(c);
            else if (es && (c == '1' || c == '2' || c == '3')) b.append(c);
            else if (es && keepBlanks && (c == SEP || c == '-' || c == ' ' || c == ',')) b.append(SEP);
            else if (keepBlanks && (c == '?' || c == '.' || c == '*')) b.append('?');
        }
        return es ? encode(b.toString(), instance.chTile) : b.toString();
    }

    public Play findPlay(List<Play> catalog, String word) {
        for (Play p : catalog) if (p.word.equals(word)) return p;
        return null;
    }

    /**
     * Word formable from the rack (blanks allowed, scored 0) and valid in this
     * lexicon — even when the dealt catalog misses it. Curated catalogs
     * (beginner lists) deliberately list only a subset, but a word the player
     * can spell from their tiles and that the dictionary accepts must be
     * playable: ATOM on a TOMATO rack was wrongly refused before.
     */
    public boolean canSpell(String rawWord, String rack) {
        String word = normalize(rawWord, false);
        String r = normalizeRack(rack);
        if (word.length() < 2 || unplayable(word)) return false;
        int[] counts = new int[ALPHABET.length()];
        int blanks = 0;
        for (int i = 0; i < r.length(); i++) {
            char c = r.charAt(i);
            if (c == '?') {
                blanks++;
                continue;
            }
            int idx = letterIndex(c);
            if (idx >= 0) counts[idx]++;
        }
        return formable(word, counts, blanks) != null;
    }

    public Play probe(String rawWord, String rack) {
        String word = normalize(rawWord, false);
        String r = normalizeRack(rack);
        if (word.length() < 2 || !has(word) || unplayable(word)) return null;
        int[] counts = new int[ALPHABET.length()];
        int blanks = 0;
        for (int i = 0; i < r.length(); i++) {
            char c = r.charAt(i);
            if (c == '?') {
                blanks++;
                continue;
            }
            int idx = letterIndex(c);
            if (idx >= 0) counts[idx]++;
        }
        int[] jokers = formable(word, counts, blanks);
        if (jokers == null) return null;
        Set<Integer> jk = new HashSet<>();
        for (int j : jokers) jk.add(j);
        return new Play(word, scoreWord(word, jk), jokers);
    }

    public List<Play> anagrams(String rack, int minLen, int maxLen) {
        int[] counts = new int[ALPHABET.length()];
        int blanks = 0;
        int tiles = 0;
        for (int i = 0; i < rack.length(); i++) {
            char ch = rack.charAt(i);
            if (ch == '?' || ch == '.' || ch == '*') {
                blanks++;
                tiles++;
            } else {
                int index = letterIndex(ch);
                if (index < 0) continue;
                counts[index]++;
                tiles++;
            }
        }
        int hi = Math.min(maxLen, tiles);
        int lo = Math.max(2, minLen);
        ArrayList<Play> all = new ArrayList<>();
        for (int len = hi; len >= lo; len--) {
            for (String word : byLen[len]) {
                int[] jokers = formable(word, counts, blanks);
                if (jokers == null) continue;
                HashSet<Integer> jk = new HashSet<>();
                for (int j : jokers) jk.add(j);
                all.add(new Play(word, points(word, jk), jokers));
            }
        }
        Collections.sort(all, (a, b) -> {
            int d = b.pts() - a.pts();
            if (d != 0) return d;
            d = b.word.length() - a.word.length();
            if (d != 0) return d;
            return a.word.compareTo(b.word);
        });
        return all;
    }

    private static int[] formable(String word, int[] counts, int blanks) {
        int[] used = new int[ALPHABET.length()];
        int need = 0;
        int[] jk = new int[word.length()];
        for (int i = 0; i < word.length(); i++) {
            int c = letterIndex(word.charAt(i));
            if (c < 0) return null;
            used[c]++;
            if (used[c] > counts[c]) {
                if (need >= blanks) return null;
                jk[need++] = i;
            }
        }
        if (need == 0) return new int[0];
        int[] out = new int[need];
        System.arraycopy(jk, 0, out, 0, need);
        return out;
    }

    private void buildPools() {
        bingo = new ArrayList<>(byLen[7]);
        longWords = new ArrayList<>(byLen[6]);
        bingoRich = new ArrayList<>();
        longRich = new ArrayList<>();
        hard = new ArrayList<>();
        for (String w : bingo) if (points(w, null) >= 12) bingoRich.add(w);
        for (String w : longWords) if (points(w, null) >= 11) longRich.add(w);
        for (int len = 3; len <= 5; len++) {
            for (String w : byLen[len]) {
                if (usesHard(w, null) && points(w, null) >= 11) hard.add(w);
            }
        }
    }

    private boolean usesHard(String word, int[] jokers) {
        boolean[] jk = new boolean[word.length()];
        if (jokers != null) for (int j : jokers) if (j >= 0 && j < jk.length) jk[j] = true;
        for (int i = 0; i < word.length(); i++) {
            if (jk[i]) continue;
            char ch = word.charAt(i);
            int index = letterIndex(ch);
            if (index >= 0 && hardMask[index]) return true;
        }
        return false;
    }

    public Deal challenge() {
        for (int attempt = 0; attempt < 20; attempt++) {
            double roll = rng.nextDouble();
            String category = "bingo";
            String seed;
            String rack;
            if (roll < 0.4 && (!bingoRich.isEmpty() || !bingo.isEmpty())) {
                seed = pick(bingoRich.isEmpty() || rng.nextDouble() >= 0.7 ? bingo : bingoRich);
                rack = shuffle(seed);
            } else if (roll < 0.65 && (!longRich.isEmpty() || !longWords.isEmpty())) {
                category = "long";
                seed = pick(longRich.isEmpty() || rng.nextDouble() >= 0.7 ? longWords : longRich);
                rack = shuffle(seed + fillTiles(seed, 1));
            } else if (!hard.isEmpty()) {
                category = "hard";
                seed = pick(hard);
                String extra = seed.length() == 3 ? fillTiles(seed, 1) : "";
                rack = shuffle(seed + extra);
            } else {
                continue;
            }
            List<Play> catalog = anagrams(rack, 2, rack.length());
            if (catalog.isEmpty()) continue;
            Play best = catalog.get(0);
            boolean hardBest = usesHard(best.word, best.jokers);
            if ("bingo".equals(category) && best.word.length() != 7) continue;
            if ("long".equals(category)) {
                if (best.word.length() == 7) category = "bingo";
                else if (best.word.length() < 6) continue;
            }
            if ("hard".equals(category)) {
                if (!hardBest) continue;
                if (best.word.length() >= 6) category = best.word.length() == 7 ? "bingo" : "long";
                else if (best.score < 10) continue;
            }
            if (best.word.length() <= 4 && !hardBest && best.score < 12) continue;
            return new Deal(category, rack, catalog);
        }
        String fallback = "es".equals(lang) ? "PALABRA" : "LETTRES";
        String seed = bingo.isEmpty() ? fallback : pick(bingo);
        String rack = shuffle(seed);
        return new Deal("bingo", rack, anagrams(rack, 2, rack.length()));
    }

    public Deal training(String rawPreset) {
        return training(rawPreset, 2);
    }

    /** minLen only narrows the free "all" preset — the targeted presets keep
     *  their inherent word length. Keeps "all" from drowning in 47 tiny words. */
    public Deal training(String rawPreset, int minLen) {
        String preset = rawPreset == null ? "all" : rawPreset;
        if ("small".equals(preset)) return smallTraining();
        int target = "eight".equals(preset) || "plusOne".equals(preset) ? 8 : 7;
        List<String> base = byLen[target];
        if (base == null || base.isEmpty()) return challenge();
        ArrayList<String> source = new ArrayList<>();
        if ("hard".equals(preset)) {
            for (String word : base) if (usesHard(word, null)) source.add(word);
        }
        if (source.isEmpty()) source.addAll(base);
        for (int attempt = 0; attempt < 40; attempt++) {
            String seed = pick(source);
            String rack = seed;
            int bonusIndex = -1;
            if ("plusOne".equals(preset)) {
                int at = rng.nextInt(seed.length());
                char bonus = seed.charAt(at);
                String seven = seed.substring(0, at) + seed.substring(at + 1);
                rack = shuffle(seven) + bonus;
                bonusIndex = rack.length() - 1;
            }
            if ("joker".equals(preset)) {
                int at = rng.nextInt(seed.length());
                rack = seed.substring(0, at) + "?" + seed.substring(at + 1);
                rack = shuffle(rack);
            } else if (!"plusOne".equals(preset)) {
                rack = shuffle(rack);
            }
            int min = "all".equals(preset) ? Math.max(2, Math.min(7, minLen)) : target;
            List<Play> catalog = anagrams(rack, min, target);
            if (!catalog.isEmpty()) {
                return new Deal("training-" + preset, rack, catalog, seed, bonusIndex);
            }
        }
        return challenge();
    }

    /**
     * "Petits mots": a short rack (3–5 tiles), usually seeded with a hard
     * letter (J, K, Q, W, X, Y, Z — Ñ in Spanish) that at least one answer
     * uses. Only the 2- and 3-letter words count; 2–12 answers per rack.
     */
    public Deal smallTraining() {
        StringBuilder hardPool = new StringBuilder();
        for (int i = 0; i < ALPHABET.length(); i++) {
            if (hardMask[i] && bag[i] > 0) hardPool.append(ALPHABET.charAt(i));
        }
        for (int attempt = 0; attempt < 120; attempt++) {
            double roll = rng.nextDouble();
            int n = roll < 0.35 ? 3 : roll < 0.8 ? 4 : 5;
            String hard = hardPool.length() > 0 && rng.nextDouble() < 0.7
                    ? String.valueOf(hardPool.charAt(rng.nextInt(hardPool.length()))) : "";
            String rack = shuffle(hard + fillTiles(hard, n - hard.length()));
            if (rack.length() < n) break;
            List<Play> catalog = anagrams(rack, 2, 3);
            int total = catalog.size();
            if (total < 2 || total > 12) continue;
            if (!hard.isEmpty()) {
                boolean uses = false;
                for (Play p : catalog) if (p.word.indexOf(hard.charAt(0)) >= 0) { uses = true; break; }
                if (!uses) continue;
            }
            return new Deal("training-small", rack, catalog, rack, -1);
        }
        return training("all", 2);
    }

    public Deal kidsDeal() {
        String seed = encodeKids(Kids.pickLong(lang, rng));
        String rack = shuffle(seed);
        return new Deal("kids", rack, kidsAnagrams(rack), seed);
    }

    private String encodeKids(String word) {
        return "es".equals(lang) ? encode(word, chTile) : word;
    }

    private String[] kidsEncoded;

    private String[] kidsWords() {
        if (kidsEncoded == null) {
            String[] raw = Kids.words(lang);
            kidsEncoded = new String[raw.length];
            for (int i = 0; i < raw.length; i++) kidsEncoded[i] = encodeKids(raw[i]);
        }
        return kidsEncoded;
    }

    public Deal fromRack(String rack) {
        return fromRack(rack, "");
    }

    public Deal fromRack(String rack, String seed) {
        // Racks arrive in display form; a '·' keeps two single tiles apart.
        String tiles = normalizeRack(rack).replace("?", "");
        if (tiles.length() < 2) return challenge();
        int max = seed.isEmpty() ? 7 : 8;
        if (tiles.length() > max) tiles = tiles.substring(0, max);
        List<Play> catalog = seed.isEmpty()
                ? anagrams(tiles, 2, tiles.length())
                : kidsAnagrams(tiles);
        return new Deal(seed.isEmpty() ? guessCategory(tiles) : "kids", tiles, catalog, normalize(seed));
    }

    private List<Play> kidsAnagrams(String rack) {
        int[] counts = new int[ALPHABET.length()];
        int tiles = 0;
        for (int i = 0; i < rack.length(); i++) {
            char ch = rack.charAt(i);
            int index = letterIndex(ch);
            if (index >= 0) {
                counts[index]++;
                tiles++;
            }
        }
        ArrayList<Play> out = new ArrayList<>();
        HashSet<String> seen = new HashSet<>();
        for (String word : kidsWords()) {
            if (word.length() < 3 || word.length() > tiles || !seen.add(word)) continue;
            if (formable(word, counts, 0) == null) continue;
            out.add(new Play(word, points(word, null), new int[0]));
        }
        Collections.sort(out, (a, b) -> {
            int d = b.pts() - a.pts();
            if (d != 0) return d;
            d = b.word.length() - a.word.length();
            if (d != 0) return d;
            return a.word.compareTo(b.word);
        });
        return out;
    }

    private String guessCategory(String tiles) {
        List<Play> cat = anagrams(tiles, 2, tiles.length());
        if (!cat.isEmpty() && cat.get(0).word.length() == 7) return "bingo";
        if (tiles.length() <= 5) return "hard";
        if (!cat.isEmpty() && cat.get(0).word.length() >= 6) return "long";
        return "hard";
    }

    private String pick(List<String> list) {
        return list.get(rng.nextInt(list.size()));
    }

    private String shuffle(String word) {
        char[] a = word.toCharArray();
        for (int i = a.length - 1; i > 0; i--) {
            int j = rng.nextInt(i + 1);
            char t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return new String(a);
    }

    private String fillTiles(String used, int n) {
        int[] have = new int[ALPHABET.length()];
        for (int i = 0; i < used.length(); i++) {
            char ch = used.charAt(i);
            int index = letterIndex(ch);
            if (index >= 0) have[index]++;
        }
        StringBuilder bag = new StringBuilder(100);
        for (int i = 0; i < ALPHABET.length(); i++) {
            for (int k = have[i]; k < this.bag[i]; k++) bag.append(ALPHABET.charAt(i));
        }
        StringBuilder out = new StringBuilder(n);
        for (int i = 0; i < n && bag.length() > 0; i++) {
            int idx = rng.nextInt(bag.length());
            out.append(bag.charAt(idx));
            bag.deleteCharAt(idx);
        }
        return out.toString();
    }

    public static String categoryLabel(String cat) {
        if ("bingo".equals(cat)) return "Bingo";
        if ("long".equals(cat)) return "Mot long";
        if ("hard".equals(cat)) return "Lettres dures";
        return "Défi";
    }

    public static List<Play> topWords(List<Play> catalog, Play played, int n) {
        ArrayList<Play> list = new ArrayList<>();
        HashSet<String> seen = new HashSet<>();
        for (Play p : catalog) {
            if (p == null || seen.contains(p.word)) continue;
            seen.add(p.word);
            list.add(p);
            if (list.size() >= n) break;
        }
        if (played != null && !seen.contains(played.word)) list.add(played);
        return list;
    }
}
