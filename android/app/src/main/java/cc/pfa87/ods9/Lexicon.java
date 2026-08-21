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

public final class Lexicon {
    private static final String ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
    public static final int[] VAL = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 10, 1, 2, 1, 0, 1, 3, 8, 1, 1, 1, 1, 4, 10, 10, 10, 10
    };
    private static final int[] VAL_EN = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 0, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10
    };
    private static final int[] VAL_ES = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 10, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 4, 10, 8, 4, 10
    };
    private static final int[] BAG = {
        9, 2, 2, 3, 15, 2, 2, 2, 8, 1, 1, 5, 3, 6, 0, 6, 2, 1, 6, 6, 6, 6, 2, 1, 1, 1, 1
    };
    private static final int[] BAG_EN = {
        9, 2, 2, 4, 12, 2, 3, 2, 9, 1, 1, 4, 2, 6, 0, 8, 2, 1, 6, 4, 6, 4, 2, 2, 1, 2, 1
    };
    private static final int[] BAG_ES = {
        13, 2, 4, 5, 12, 1, 2, 2, 6, 1, 1, 4, 2, 5, 1, 9, 2, 1, 5, 6, 4, 5, 1, 1, 1, 1, 1
    };
    private static final boolean[] HARD = new boolean[ALPHABET.length()];

    static {
        for (char c : new char[] {'J', 'K', 'Ñ', 'Q', 'W', 'X', 'Y', 'Z'}) {
            HARD[letterIndex(c)] = true;
        }
    }

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
    private final int[] val;
    private final int[] bag;
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
        String dict = Dict.normalize(dictOrLang);
        if (dict.isEmpty()) dict = Dict.defaultFor(dictOrLang);
        String wanted = Dict.langOf(dict);
        if (instance == null || !wanted.equals(instance.lang) || !dict.equals(instance.dict)) {
            instance = new Lexicon(ctx.getApplicationContext(), wanted, dict);
        }
        return instance;
    }

    public static synchronized boolean ready() {
        return instance != null;
    }

    private Lexicon(Context ctx, String lang, String dict) throws IOException {
        this.lang = lang;
        this.dict = dict;
        this.val = "en".equals(lang) ? VAL_EN : "es".equals(lang) ? VAL_ES : VAL;
        this.bag = "en".equals(lang) ? BAG_EN : "es".equals(lang) ? BAG_ES : BAG;
        for (int i = 0; i < byLen.length; i++) byLen[i] = new ArrayList<>();
        InputStream raw = openLexicon(ctx, dict);
        try (BufferedReader r = new BufferedReader(new InputStreamReader(raw, StandardCharsets.UTF_8), 64 * 1024)) {
            String line;
            while ((line = r.readLine()) != null) {
                if (line.isEmpty()) continue;
                set.add(line);
                if (line.length() < 16) byLen[line.length()].add(line);
                count++;
            }
        }
        buildPools();
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

    public String exportText() {
        StringBuilder b = new StringBuilder(Math.max(16, count * 8));
        for (int len = 2; len < byLen.length; len++) {
            for (String w : byLen[len]) b.append(w).append('\n');
        }
        return b.toString();
    }

    public static String exportFileName(String dictOrLang) {
        String dict = Dict.normalize(dictOrLang);
        if (dict.isEmpty()) dict = Dict.defaultFor(dictOrLang);
        if (Dict.CSW.equals(dict)) return "verimots-en-csw.txt";
        if (Dict.WOW24.equals(dict)) return "verimots-en-wow24.txt";
        if (Dict.RLA.equals(dict)) return "verimots-es-rla.txt";
        return "verimots-fr-ods.txt";
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
            b.append(words.get(i));
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
            if (letterIndex(c) >= 0) b.append(c);
            else if (keepBlanks && (c == '?' || c == '.' || c == '*')) b.append('?');
        }
        return b.toString();
    }

    public Play findPlay(List<Play> catalog, String word) {
        for (Play p : catalog) if (p.word.equals(word)) return p;
        return null;
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

    private static boolean usesHard(String word, int[] jokers) {
        boolean[] jk = new boolean[word.length()];
        if (jokers != null) for (int j : jokers) if (j >= 0 && j < jk.length) jk[j] = true;
        for (int i = 0; i < word.length(); i++) {
            if (jk[i]) continue;
            char ch = word.charAt(i);
            int index = letterIndex(ch);
            if (index >= 0 && HARD[index]) return true;
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
        String preset = rawPreset == null ? "all" : rawPreset;
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
            int min = "all".equals(preset) || "hard".equals(preset) ? 2 : target;
            List<Play> catalog = anagrams(rack, min, target);
            if (!catalog.isEmpty()) {
                return new Deal("training-" + preset, rack, catalog, seed, bonusIndex);
            }
        }
        return challenge();
    }

    public Deal kidsDeal() {
        String seed = Kids.pickLong(lang, rng);
        String rack = shuffle(seed);
        return new Deal("kids", rack, kidsAnagrams(rack), seed);
    }

    public Deal fromRack(String rack) {
        return fromRack(rack, "");
    }

    public Deal fromRack(String rack, String seed) {
        String tiles = normalize(rack);
        if (tiles.length() < 2) return challenge();
        int max = seed.isEmpty() ? 7 : 8;
        if (tiles.length() > max) tiles = tiles.substring(0, max);
        List<Play> catalog = seed.isEmpty()
                ? anagrams(tiles, 2, tiles.length())
                : kidsAnagrams(tiles);
        return new Deal(seed.isEmpty() ? guessCategory(tiles) : "kids", tiles, catalog, seed);
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
        for (String word : Kids.words(lang)) {
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
