package cc.pfa87.ods9;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** Same scenarios as tests/ods-reviews.test.mjs, against the Java copy of the rules. */
public final class ReviewRulesTest {
    private static int checks;
    private static final long T0 = 1_791_277_200_000L; // 6 Oct 2026 09:00 UTC
    private static final Random RND = new Random(7);

    private static void check(boolean condition, String message) {
        checks++;
        if (!condition) throw new AssertionError(message);
    }

    private static ReviewRules.Item bingo(String rack) {
        ReviewRules.Item i = new ReviewRules.Item();
        i.game = "bingo";
        i.rack = rack;
        i.lang = "fr";
        i.dict = "ods";
        i.edition = "fise";
        i.targets.add(new ReviewRules.Word("JUKEBOX", 84));
        i.played = new ReviewRules.Word("BOXE", 23);
        return i;
    }

    public static void main(String[] args) {
        List<ReviewRules.Item> none = new ArrayList<>();
        ReviewRules.Recorded first = ReviewRules.recordMiss(none, bingo("KOBXEUJ"), T0, RND);
        check(first.items.size() == 1 && first.item.due == T0 && first.item.step == 0, "a miss is due at once");
        check(ReviewRules.due(first.items, T0).size() == 1, "and listed as due");

        ReviewRules.Recorded again = ReviewRules.recordMiss(first.items, bingo("JUEXBOK"), T0 + 5000, RND);
        check(again.items.size() == 1 && again.item.id.equals(first.item.id), "same tiles, another order = same draw");
        ReviewRules.Item combi = bingo("KOBXEUJ");
        combi.game = "combi";
        combi.preset = "seven";
        combi.min = 7;
        combi.max = 7;
        check(ReviewRules.recordMiss(again.items, combi, T0, RND).items.size() == 2, "a combination is another draw");

        ReviewRules.Item item = first.item;
        long now = T0;
        for (int days : ReviewRules.STEPS) {
            item = ReviewRules.grade(item, "ok", now, now);
            check(item.due == now + days * ReviewRules.DAY_MS && !item.mastered, "step of " + days + " days");
            now = item.due;
        }
        item = ReviewRules.grade(item, "ok", now, now);
        check(item.mastered && item.reps == ReviewRules.STEPS.length + 1, "mastered after the last step");

        ReviewRules.Item h = ReviewRules.grade(first.item, "ok", T0, T0);
        ReviewRules.Item help = ReviewRules.grade(h, "help", h.due, h.due);
        check(help.step == 1 && help.due == h.due + ReviewRules.DAY_MS, "a hint keeps the step, back tomorrow");
        ReviewRules.Item miss = ReviewRules.grade(help, "miss", help.due, help.due);
        check(miss.step == 0 && miss.lapses == 1, "a shown answer starts over");

        ReviewRules.Item early = ReviewRules.grade(h, "ok", T0 + 3_600_000L, T0 + 3_600_000L);
        check(early.due == h.due && early.step == h.step, "early replay does not move the schedule");
        ReviewRules.Item ready = ReviewRules.grade(h, "ok", h.due - 7_200_000L, h.due + 3_600_000L);
        check(ready.step == h.step + 1, "the end-of-day cutoff makes tomorrow's draw ready in the morning");

        ReviewRules.Item bad = bingo("A<B>");
        bad.id = "abcdef1";
        check(ReviewRules.clean(bad) == null, "bad rack refused");
        ReviewRules.Item blank = bingo("AE?RST");
        blank.id = "abcdef2";
        check(ReviewRules.clean(blank) != null, "a blank is a valid rack tile");

        ReviewRules.Item later = ReviewRules.grade(first.item, "ok", T0 + 1000, T0 + 1000);
        List<ReviewRules.Item> a = new ArrayList<>();
        a.add(first.item);
        List<ReviewRules.Item> b = new ArrayList<>();
        b.add(later);
        check(ReviewRules.merge(a, b, T0 + 2000).get(0).step == 1, "the latest change wins");
        List<ReviewRules.Item> gone = ReviewRules.delete(b, first.item.id, T0 + 3000);
        List<ReviewRules.Item> merged = ReviewRules.merge(b, gone, T0 + 4000);
        check(ReviewRules.live(merged).isEmpty() && merged.get(0).deleted, "a deletion travels");
        ReviewRules.Item other = ReviewRules.recordMiss(none, bingo("XOBKEJU"), T0 + 500, RND).item;
        List<ReviewRules.Item> o = new ArrayList<>();
        o.add(other);
        check(ReviewRules.merge(a, o, T0 + 1000).size() == 1, "two ids for one draw collapse");

        check(ReviewRules.key(first.item).equals("ods|fise|bingo|BEJKOUX"), "key matches the web: " + ReviewRules.key(first.item));
        System.out.println("ReviewRules: " + checks + " checks passed");
    }
}
