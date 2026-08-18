package cc.pfa87.ods9;

import android.content.Context;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.zip.GZIPInputStream;

public final class Lexicon {
    public static final int[] VAL = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 10, 1, 2, 1, 1, 3, 8, 1, 1, 1, 1, 4, 10, 10, 10, 10
    };
    private static final int[] VAL_EN = {
        1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10
    };
    private static final int[] BAG = {
        9, 2, 2, 3, 15, 2, 2, 2, 8, 1, 1, 5, 3, 6, 6, 2, 1, 6, 6, 6, 6, 2, 1, 1, 1, 1
    };
    private static final int[] BAG_EN = {
        9, 2, 2, 4, 12, 2, 3, 2, 9, 1, 1, 4, 2, 6, 8, 2, 1, 6, 4, 6, 4, 2, 2, 1, 2, 1
    };
    private static final boolean[] HARD = new boolean[26];

    static {
        for (char c : new char[] {'J', 'K', 'Q', 'W', 'X', 'Y', 'Z'}) {
            HARD[c - 'A'] = true;
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

        Deal(String category, String rack, List<Play> catalog) {
            this.category = category;
            this.rack = rack;
            this.catalog = catalog;
        }
    }

    private static Lexicon instance;
    private static Lexicon instanceFr;
    private static Lexicon instanceEn;
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
        return get(ctx, "fr");
    }

    public static synchronized Lexicon get(Context ctx, String lang) throws IOException {
        boolean en = "en".equals(lang);
        if (en) {
            if (instanceEn == null) instanceEn = new Lexicon(ctx.getApplicationContext(), true);
            instance = instanceEn;
            return instanceEn;
        }
        if (instanceFr == null) instanceFr = new Lexicon(ctx.getApplicationContext(), false);
        instance = instanceFr;
        return instanceFr;
    }

    public static synchronized boolean ready() {
        return instance != null;
    }

    private Lexicon(Context ctx, boolean english) throws IOException {
        this.val = english ? VAL_EN : VAL;
        this.bag = english ? BAG_EN : BAG;
        for (int i = 0; i < byLen.length; i++) byLen[i] = new ArrayList<>();
        InputStream raw = openLexicon(ctx, english);
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

    private static InputStream openLexicon(Context ctx, boolean english) throws IOException {
        String gz = english ? "data/enable.txt.gz" : "data/ods9.txt.gz";
        String plain = english ? "data/enable.txt" : "data/ods9.txt";
        try {
            return new GZIPInputStream(ctx.getAssets().open(gz));
        } catch (IOException e) {
            return ctx.getAssets().open(plain);
        }
    }

    public int size() {
        return count;
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

    public static int letterScore(char ch) {
        if (ch < 'A' || ch > 'Z') return 0;
        int[] table = instance != null ? instance.val : VAL;
        return table[ch - 'A'];
    }

    private int points(String word, Set<Integer> jokers) {
        int n = 0;
        for (int i = 0; i < word.length(); i++) {
            if (jokers != null && jokers.contains(i)) continue;
            char ch = word.charAt(i);
            if (ch >= 'A' && ch <= 'Z') n += val[ch - 'A'];
        }
        return n;
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
        String s = java.text.Normalizer.normalize(String.valueOf(raw == null ? "" : raw), java.text.Normalizer.Form.NFD);
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '\u0300' && c <= '\u036f') continue;
            if (c >= 'a' && c <= 'z') c = (char) (c - 32);
            if (c >= 'A' && c <= 'Z') b.append(c);
            else if (keepBlanks && (c == '?' || c == '.' || c == '*')) b.append('?');
        }
        return b.toString();
    }

    public Play findPlay(List<Play> catalog, String word) {
        for (Play p : catalog) if (p.word.equals(word)) return p;
        return null;
    }

    public List<Play> anagrams(String rack, int minLen, int maxLen) {
        int[] counts = new int[26];
        int blanks = 0;
        int tiles = 0;
        for (int i = 0; i < rack.length(); i++) {
            char ch = rack.charAt(i);
            if (ch == '?' || ch == '.' || ch == '*') {
                blanks++;
                tiles++;
            } else if (ch >= 'A' && ch <= 'Z') {
                counts[ch - 'A']++;
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
        int[] used = new int[26];
        int need = 0;
        int[] jk = new int[word.length()];
        for (int i = 0; i < word.length(); i++) {
            int c = word.charAt(i) - 'A';
            if (c < 0 || c > 25) return null;
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
            if (ch >= 'A' && ch <= 'Z' && HARD[ch - 'A']) return true;
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
        String seed = bingo.isEmpty() ? "LETTRES" : pick(bingo);
        String rack = shuffle(seed);
        return new Deal("bingo", rack, anagrams(rack, 2, rack.length()));
    }

    public Deal fromRack(String rack) {
        String tiles = normalize(rack);
        if (tiles.length() < 2) return challenge();
        if (tiles.length() > 7) tiles = tiles.substring(0, 7);
        return new Deal(guessCategory(tiles), tiles, anagrams(tiles, 2, tiles.length()));
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
        int[] have = new int[26];
        for (int i = 0; i < used.length(); i++) {
            char ch = used.charAt(i);
            if (ch >= 'A' && ch <= 'Z') have[ch - 'A']++;
        }
        StringBuilder bag = new StringBuilder(100);
        for (int i = 0; i < 26; i++) {
            for (int k = have[i]; k < this.bag[i]; k++) bag.append((char) ('A' + i));
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
