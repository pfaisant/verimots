package cc.pfa87.ods9;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Random;

/**
 * Révisions on the phone: the list in private preferences (same JSON as the
 * web's localStorage 'verimots-reviews-v1'), and its sync with a Google
 * account through POST /api/game/reviews. Rules live in ReviewRules.
 */
final class ReviewStore {
    private static final String PREF = "verimots-reviews";
    private static final String KEY = "data";
    private static final Random RANDOM = new Random();

    private ReviewStore() {}

    static final class Data {
        /** Google account the list was last synced with ('' = this device only). */
        String owner = "";
        List<ReviewRules.Item> items = new ArrayList<>();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    static Data load(Context ctx) {
        Data d = new Data();
        try {
            JSONObject o = new JSONObject(prefs(ctx).getString(KEY, "{}"));
            d.owner = o.optString("owner", "");
            d.items = fromJson(o.optJSONArray("items"));
        } catch (Exception e) {
            DiagLog.error("reviews", "stored list unreadable", e);
        }
        return d;
    }

    static void save(Context ctx, Data d) {
        try {
            JSONObject o = new JSONObject();
            o.put("owner", d.owner == null ? "" : d.owner);
            o.put("items", toJson(d.items));
            prefs(ctx).edit().putString(KEY, o.toString()).apply();
        } catch (Exception e) {
            DiagLog.error("reviews", "list not saved", e);
        }
    }

    // ---- JSON ----------------------------------------------------------------

    static List<ReviewRules.Item> fromJson(JSONArray rows) {
        ArrayList<ReviewRules.Item> out = new ArrayList<>();
        if (rows == null) return out;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject o = rows.optJSONObject(i);
            if (o == null) continue;
            ReviewRules.Item raw = new ReviewRules.Item();
            raw.id = o.optString("id", "");
            raw.deleted = o.optBoolean("deleted", false);
            raw.updatedAt = o.optLong("updatedAt", 0);
            raw.lang = o.optString("lang", "");
            raw.dict = o.optString("dict", "");
            raw.edition = o.optString("edition", "fise");
            raw.game = o.optString("game", "");
            raw.rack = o.optString("rack", "");
            JSONArray targets = o.optJSONArray("targets");
            if (targets != null) {
                for (int j = 0; j < targets.length(); j++) {
                    JSONObject t = targets.optJSONObject(j);
                    if (t != null) raw.targets.add(new ReviewRules.Word(t.optString("w", ""), t.optInt("p", 0)));
                }
            }
            JSONObject played = o.optJSONObject("played");
            if (played != null) raw.played = new ReviewRules.Word(played.optString("w", ""), played.optInt("p", 0));
            raw.missedAt = o.optLong("missedAt", 0);
            raw.due = o.has("due") ? o.optLong("due", -1) : -1;
            raw.step = o.optInt("step", 0);
            raw.reps = o.optInt("reps", 0);
            raw.lapses = o.optInt("lapses", 0);
            raw.mastered = o.optBoolean("mastered", false);
            raw.last = o.optString("last", "new");
            raw.preset = o.optString("preset", "");
            raw.min = o.optInt("min", 0);
            raw.max = o.optInt("max", 0);
            raw.bonus = o.optInt("bonus", -1);
            ReviewRules.Item item = ReviewRules.clean(raw);
            if (item != null) out.add(item);
        }
        return out;
    }

    static JSONArray toJson(List<ReviewRules.Item> items) throws Exception {
        JSONArray out = new JSONArray();
        for (ReviewRules.Item i : items) {
            JSONObject o = new JSONObject();
            o.put("id", i.id);
            o.put("updatedAt", i.updatedAt);
            if (i.deleted) {
                o.put("deleted", true);
                out.put(o);
                continue;
            }
            o.put("lang", i.lang);
            o.put("dict", i.dict);
            o.put("edition", i.edition);
            o.put("game", i.game);
            o.put("rack", i.rack);
            JSONArray targets = new JSONArray();
            for (ReviewRules.Word w : i.targets) targets.put(new JSONObject().put("w", w.w).put("p", w.p));
            o.put("targets", targets);
            o.put("played", i.played == null ? JSONObject.NULL : new JSONObject().put("w", i.played.w).put("p", i.played.p));
            o.put("missedAt", i.missedAt);
            o.put("due", i.due);
            o.put("step", i.step);
            o.put("reps", i.reps);
            o.put("lapses", i.lapses);
            o.put("mastered", i.mastered);
            o.put("last", i.last);
            if (i.combi()) {
                o.put("preset", i.preset);
                o.put("min", i.min);
                o.put("max", i.max);
                o.put("bonus", i.bonus);
            }
            out.put(o);
        }
        return out;
    }

    // ---- day boundaries --------------------------------------------------------

    /** End of the player's local day: a draw due any time today is ready now. */
    static long endOfDay(long now) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        c.set(Calendar.HOUR_OF_DAY, 23);
        c.set(Calendar.MINUTE, 59);
        c.set(Calendar.SECOND, 59);
        c.set(Calendar.MILLISECOND, 999);
        return c.getTimeInMillis();
    }

    /** Calendar days from now to `due` (0 = today). */
    static int daysUntil(long due, long now) {
        Calendar a = Calendar.getInstance();
        a.setTimeInMillis(now);
        Calendar b = Calendar.getInstance();
        b.setTimeInMillis(due);
        int days = 0;
        while (a.get(Calendar.YEAR) != b.get(Calendar.YEAR) || a.get(Calendar.DAY_OF_YEAR) != b.get(Calendar.DAY_OF_YEAR)) {
            a.add(Calendar.DAY_OF_YEAR, 1);
            if (++days > 400) break;
        }
        return days;
    }

    // ---- recording -------------------------------------------------------------

    /** Saves a missed draw (display-form rack and words); null when nothing worth saving. */
    static ReviewRules.Item record(Context ctx, ReviewRules.Item miss) {
        Data d = load(ctx);
        ReviewRules.Recorded r = ReviewRules.recordMiss(d.items, miss, System.currentTimeMillis(), RANDOM);
        if (r.item == null) return null;
        d.items = r.items;
        save(ctx, d);
        DiagLog.i("reviews", "missed draw saved (" + r.item.game + ", " + r.item.targets.size() + " word(s))");
        return r.item;
    }

    static ReviewRules.Item grade(Context ctx, String id, String outcome) {
        Data d = load(ctx);
        long now = System.currentTimeMillis();
        for (ReviewRules.Item i : d.items) {
            if (i.id.equals(id) && !i.deleted) {
                ReviewRules.Item graded = ReviewRules.grade(i, outcome, now, endOfDay(now));
                d.items = ReviewRules.replace(d.items, graded);
                save(ctx, d);
                return graded;
            }
        }
        return null;
    }

    static void delete(Context ctx, String id) {
        Data d = load(ctx);
        d.items = ReviewRules.delete(d.items, id, System.currentTimeMillis());
        save(ctx, d);
    }

    static void restore(Context ctx, ReviewRules.Item item) {
        Data d = load(ctx);
        ReviewRules.Item back = item.copy();
        back.updatedAt = System.currentTimeMillis();
        ArrayList<ReviewRules.Item> rest = new ArrayList<>();
        for (ReviewRules.Item i : d.items) if (!i.id.equals(back.id)) rest.add(i);
        ArrayList<ReviewRules.Item> one = new ArrayList<>();
        one.add(back);
        d.items = ReviewRules.merge(one, rest, back.updatedAt);
        save(ctx, d);
    }

    // ---- sync ---------------------------------------------------------------

    private static boolean syncing;

    /**
     * Google accounts only. Another account's draws never move into this one;
     * a list kept without an account joins the account that signs in.
     */
    static void sync(Context ctx, Runnable done) {
        if (!Session.loggedIn(ctx) || syncing) {
            if (done != null) done.run();
            return;
        }
        final String owner = Session.owner(ctx);
        if (owner.isEmpty()) {
            if (done != null) done.run();
            return;
        }
        lastAttempt = System.currentTimeMillis();
        Data local = load(ctx);
        boolean mine = local.owner.isEmpty() || local.owner.equals(owner);
        JSONArray payload;
        try {
            payload = toJson(mine ? local.items : new ArrayList<>());
        } catch (Exception e) {
            if (done != null) done.run();
            return;
        }
        syncing = true;
        final Context app = ctx.getApplicationContext();
        RemoteApi.syncReviews(owner, payload, new RemoteApi.ReviewsCb() {
            @Override
            public void ok(JSONArray items) {
                syncing = false;
                if (Session.loggedIn(app) && owner.equals(Session.owner(app))) {
                    Data latest = load(app);
                    List<ReviewRules.Item> keep = latest.owner.isEmpty() || latest.owner.equals(owner)
                            ? latest.items : new ArrayList<>();
                    Data next = new Data();
                    next.owner = owner;
                    next.items = ReviewRules.merge(fromJson(items), keep, System.currentTimeMillis());
                    save(app, next);
                    lastSync = System.currentTimeMillis();
                    lastFailed = false;
                }
                if (done != null) done.run();
            }

            @Override
            public void error(String message) {
                syncing = false;
                lastFailed = true;
                DiagLog.w("reviews", "sync failed: " + message);
                if (done != null) done.run();
            }
        });
    }

    static long lastSync;
    /** Last try (a failure counts too), so returning to the app does not hammer the server. */
    static long lastAttempt;
    /** The last try failed: the list stays on this device until the next one works. */
    static boolean lastFailed;
}
