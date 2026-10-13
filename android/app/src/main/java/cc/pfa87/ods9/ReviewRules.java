package cc.pfa87.ods9;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Révisions: the draws a player missed, brought back on a spaced schedule.
 * Plain Java (no Android type) so tests/ReviewRulesTest.java runs it
 * off-device. It mirrors dashboard/s/review-core.js rule for rule — the web,
 * the APK and the server merge the same lists, so change both together.
 */
final class ReviewRules {
    static final List<String> GAMES = Arrays.asList("bingo", "find", "combi");
    /** Days until the next review after each unaided success; one more success = mastered. */
    static final int[] STEPS = {1, 3, 7, 21};
    static final int LIMIT = 300;
    static final int TOMBSTONES = 200;
    static final int TOMBSTONE_DAYS = 90;
    static final long DAY_MS = 86_400_000L;
    static final int MAX_TARGETS = 12;
    static final List<String> LANGS = Arrays.asList("fr", "en", "es", "ca");
    static final List<String> DICTS = Arrays.asList("ods", "csw", "wow24", "rla", "disc");
    static final List<String> PRESETS = Arrays.asList("all", "seven", "eight", "plusOne", "joker", "hard", "small");
    static final List<String> OUTCOMES = Arrays.asList("new", "ok", "help", "miss");
    static final Pattern RACK = Pattern.compile("^[A-ZÑÇ·?]{2,24}$");
    static final Pattern WORD = Pattern.compile("^[A-ZÑÇ·]{2,20}$");
    static final Pattern ID = Pattern.compile("^[A-Za-z0-9_-]{6,40}$");

    private ReviewRules() {}

    static final class Word {
        final String w;
        final int p;

        Word(String w, int p) {
            this.w = w;
            this.p = p;
        }
    }

    static final class Item {
        String id = "";
        boolean deleted;
        long updatedAt;
        String lang = "fr";
        String dict = "ods";
        String edition = "fise";
        String game = "bingo";
        String rack = "";
        List<Word> targets = new ArrayList<>();
        Word played;
        long missedAt;
        long due;
        int step;
        int reps;
        int lapses;
        boolean mastered;
        String last = "new";
        // Combinaisons only
        String preset = "";
        int min;
        int max;
        int bonus = -1;

        Item copy() {
            Item c = new Item();
            c.id = id;
            c.deleted = deleted;
            c.updatedAt = updatedAt;
            c.lang = lang;
            c.dict = dict;
            c.edition = edition;
            c.game = game;
            c.rack = rack;
            c.targets = new ArrayList<>(targets);
            c.played = played;
            c.missedAt = missedAt;
            c.due = due;
            c.step = step;
            c.reps = reps;
            c.lapses = lapses;
            c.mastered = mastered;
            c.last = last;
            c.preset = preset;
            c.min = min;
            c.max = max;
            c.bonus = bonus;
            return c;
        }

        boolean combi() {
            return "combi".equals(game);
        }
    }

    static int clamp(long value, int lo, int hi) {
        return (int) Math.max(lo, Math.min(hi, value));
    }

    static String newId(Random random) {
        String abc = "abcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder b = new StringBuilder(14);
        for (int i = 0; i < 14; i++) b.append(abc.charAt(random.nextInt(abc.length())));
        return b.toString();
    }

    static Item tombstone(String id, long at) {
        Item t = new Item();
        t.id = id;
        t.deleted = true;
        t.updatedAt = at;
        return t;
    }

    /** Validates fields read from storage or the network; null when unusable. */
    static Item clean(Item raw) {
        if (raw == null || raw.id == null || !ID.matcher(raw.id).matches()) return null;
        if (raw.deleted) return tombstone(raw.id, Math.max(0, raw.updatedAt));
        if (!LANGS.contains(raw.lang) || !DICTS.contains(raw.dict) || !GAMES.contains(raw.game)) return null;
        String rack = raw.rack == null ? "" : raw.rack.toUpperCase(java.util.Locale.ROOT);
        if (!RACK.matcher(rack).matches()) return null;
        ArrayList<Word> targets = new ArrayList<>();
        HashSet<String> seen = new HashSet<>();
        for (Word t : raw.targets) {
            Word w = cleanWord(t);
            if (w == null || !seen.add(w.w)) continue;
            targets.add(w);
            if (targets.size() >= MAX_TARGETS) break;
        }
        if (targets.isEmpty()) return null;
        Item c = raw.copy();
        c.rack = rack;
        c.targets = targets;
        c.played = cleanWord(raw.played);
        c.edition = "na".equals(raw.edition) ? "na" : "fise";
        c.updatedAt = Math.max(0, raw.updatedAt);
        c.missedAt = raw.missedAt > 0 ? raw.missedAt : c.updatedAt;
        c.due = raw.due >= 0 ? raw.due : c.missedAt;
        c.step = clamp(raw.step, 0, STEPS.length);
        c.reps = clamp(raw.reps, 0, 9999);
        c.lapses = clamp(raw.lapses, 0, 9999);
        c.last = OUTCOMES.contains(raw.last) ? raw.last : "new";
        if (c.combi()) {
            c.preset = PRESETS.contains(raw.preset) ? raw.preset : "all";
            c.min = clamp(raw.min == 0 ? 2 : raw.min, 2, 8);
            c.max = clamp(raw.max == 0 ? 8 : raw.max, c.min, 8);
            c.bonus = clamp(raw.bonus, -1, 8);
        } else {
            c.preset = "";
            c.min = 0;
            c.max = 0;
            c.bonus = -1;
        }
        return c;
    }

    static Word cleanWord(Word raw) {
        if (raw == null || raw.w == null) return null;
        String w = raw.w.toUpperCase(java.util.Locale.ROOT);
        if (!WORD.matcher(w).matches()) return null;
        return new Word(w, clamp(raw.p, 0, 999));
    }

    /** Same game, dictionary and tiles (in any order) = the same draw. */
    static String key(Item item) {
        // Sort UTF-16 units like the web's [...rack].sort() does for these letters.
        char[] tiles = item.rack.toCharArray();
        Arrays.sort(tiles);
        String preset = item.combi() ? "|" + (item.preset.isEmpty() ? "all" : item.preset) + "|" + item.min : "";
        return item.dict + "|" + item.edition + "|" + item.game + preset + "|" + new String(tiles);
    }

    static List<Item> live(List<Item> items) {
        ArrayList<Item> out = new ArrayList<>();
        for (Item i : items) if (i != null && !i.deleted) out.add(i);
        return out;
    }

    /** Result of recordMiss: the new list and the draw as stored. */
    static final class Recorded {
        final List<Item> items;
        final Item item;

        Recorded(List<Item> items, Item item) {
            this.items = items;
            this.item = item;
        }
    }

    /**
     * A draw that ended without the words that mattered. Missing the same
     * draw again brings it back to the start of the schedule.
     */
    static Recorded recordMiss(List<Item> items, Item miss, long now, Random random) {
        Item draft = miss.copy();
        draft.id = newId(random);
        draft.deleted = false;
        draft.missedAt = now;
        draft.due = now;
        draft.step = 0;
        draft.reps = 0;
        draft.lapses = 0;
        draft.mastered = false;
        draft.last = "new";
        draft.updatedAt = now;
        Item fresh = clean(draft);
        if (fresh == null) return new Recorded(items, null);
        String k = key(fresh);
        ArrayList<Item> list = new ArrayList<>(items);
        int at = -1;
        for (int i = 0; i < list.size(); i++) {
            Item it = list.get(i);
            if (it != null && !it.deleted && key(it).equals(k)) { at = i; break; }
        }
        if (at < 0) {
            list.add(0, fresh);
            return new Recorded(prune(list, now), fresh);
        }
        Item old = list.remove(at);
        Item merged = old.copy();
        for (Word w : fresh.targets) {
            boolean found = false;
            for (int i = 0; i < merged.targets.size(); i++) {
                Word t = merged.targets.get(i);
                if (t.w.equals(w.w)) {
                    merged.targets.set(i, new Word(t.w, Math.max(t.p, w.p)));
                    found = true;
                    break;
                }
            }
            if (!found && merged.targets.size() < MAX_TARGETS) merged.targets.add(w);
        }
        if (fresh.played != null) merged.played = fresh.played;
        merged.due = now;
        merged.step = 0;
        merged.lapses = old.lapses + ("new".equals(old.last) ? 0 : 1);
        merged.mastered = false;
        merged.last = "new".equals(old.last) ? "new" : "miss";
        merged.updatedAt = now;
        list.add(0, merged);
        return new Recorded(prune(list, now), merged);
    }

    /**
     * 'ok' = every word found without help, 'help' = found after a hint,
     * 'miss' = answer shown. Replaying before the due day never moves the
     * schedule; `cutoff` is the end of the player's day.
     */
    static Item grade(Item item, String outcome, long now, long cutoff) {
        if (item == null || item.deleted || !Arrays.asList("ok", "help", "miss").contains(outcome)) return item;
        boolean early = !item.mastered && item.due > cutoff;
        Item next = item.copy();
        next.last = outcome;
        next.updatedAt = now;
        if ("miss".equals(outcome)) {
            next.step = 0;
            next.due = now + DAY_MS;
            next.lapses = item.lapses + 1;
            next.mastered = false;
            return next;
        }
        if (item.mastered || early) return next;
        if ("help".equals(outcome)) {
            next.due = now + DAY_MS;
            return next;
        }
        next.reps = item.reps + 1;
        if (item.step >= STEPS.length) {
            next.mastered = true;
            return next;
        }
        next.step = item.step + 1;
        next.due = now + STEPS[item.step] * DAY_MS;
        return next;
    }

    static List<Item> replace(List<Item> items, Item item) {
        ArrayList<Item> out = new ArrayList<>(items.size());
        for (Item i : items) out.add(i.id.equals(item.id) ? item : i);
        return out;
    }

    static List<Item> delete(List<Item> items, String id, long now) {
        ArrayList<Item> out = new ArrayList<>(items.size());
        for (Item i : items) out.add(i.id.equals(id) ? tombstone(id, now) : i);
        return prune(out, now);
    }

    static boolean isDue(Item item, long cutoff) {
        return item != null && !item.deleted && !item.mastered && item.due <= cutoff;
    }

    /** Due draws, the longest-waiting first. */
    static List<Item> due(List<Item> items, long cutoff) {
        ArrayList<Item> out = new ArrayList<>();
        for (Item i : live(items)) if (isDue(i, cutoff)) out.add(i);
        Collections.sort(out, (a, b) -> a.due != b.due ? Long.compare(a.due, b.due) : Long.compare(a.missedAt, b.missedAt));
        return out;
    }

    static final class Counts {
        int due;
        int later;
        int mastered;
        int total;
        long next;
    }

    static Counts counts(List<Item> items, long cutoff) {
        Counts c = new Counts();
        for (Item i : live(items)) {
            c.total++;
            if (i.mastered) c.mastered++;
            else if (i.due <= cutoff) c.due++;
            else {
                c.later++;
                if (c.next == 0 || i.due < c.next) c.next = i.due;
            }
        }
        return c;
    }

    /** Keeps the newest deletions for sync and drops the oldest draws past the limit. */
    static List<Item> prune(List<Item> items, long now) {
        ArrayList<Item> liveList = new ArrayList<>();
        ArrayList<Item> gone = new ArrayList<>();
        for (Item i : items) {
            if (i == null) continue;
            if (i.deleted) {
                if (now - i.updatedAt <= TOMBSTONE_DAYS * DAY_MS) gone.add(i);
            } else liveList.add(i);
        }
        if (liveList.size() > LIMIT) {
            ArrayList<Item> order = new ArrayList<>(liveList);
            Collections.sort(order, (a, b) -> a.mastered != b.mastered ? (a.mastered ? -1 : 1) : Long.compare(a.updatedAt, b.updatedAt));
            HashSet<String> drop = new HashSet<>();
            for (int i = 0; i < liveList.size() - LIMIT; i++) drop.add(order.get(i).id);
            ArrayList<Item> kept = new ArrayList<>();
            for (Item i : liveList) if (!drop.contains(i.id)) kept.add(i);
            liveList = kept;
        }
        Collections.sort(gone, (a, b) -> Long.compare(b.updatedAt, a.updatedAt));
        ArrayList<Item> out = new ArrayList<>(liveList);
        out.addAll(gone.subList(0, Math.min(gone.size(), TOMBSTONES)));
        return out;
    }

    /**
     * Latest change to each draw wins, a deletion beats an edit made at the
     * same moment, and two ids for the same draw collapse into the newer one.
     */
    static List<Item> merge(List<Item> a, List<Item> b, long now) {
        LinkedHashMap<String, Item> byId = new LinkedHashMap<>();
        ArrayList<Item> all = new ArrayList<>();
        all.addAll(a);
        all.addAll(b);
        for (Item raw : all) {
            Item item = clean(raw);
            if (item == null) continue;
            Item prev = byId.get(item.id);
            if (prev == null || item.updatedAt > prev.updatedAt
                    || (item.updatedAt == prev.updatedAt && item.deleted && !prev.deleted)) {
                byId.put(item.id, item);
            }
        }
        ArrayList<Item> sorted = new ArrayList<>(byId.values());
        // Stable newest-first, like the web's sort.
        Collections.sort(sorted, (x, y) -> Long.compare(y.updatedAt, x.updatedAt));
        Map<String, Item> byKey = new HashMap<>();
        ArrayList<Item> out = new ArrayList<>();
        for (Item item : sorted) {
            if (item.deleted) {
                out.add(item);
                continue;
            }
            String k = key(item);
            if (byKey.containsKey(k)) continue;
            byKey.put(k, item);
            out.add(item);
        }
        return prune(out, now);
    }

    static Set<String> targetWords(Item item) {
        HashSet<String> s = new HashSet<>();
        for (Word w : item.targets) s.add(w.w);
        return s;
    }
}
