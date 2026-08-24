package cc.pfa87.ods9;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Starred words — local only, same shape as HistoryStore rows. */
final class FavStore {
    private static final String PREF = "verimots-favorites";
    private static final int MAX = 400;

    static final class Row {
        final String word;
        final int pts;
        final long at;

        Row(String word, int pts, long at) {
            this.word = word;
            this.pts = pts;
            this.at = at;
        }
    }

    static List<Row> load(Context ctx) {
        ArrayList<Row> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(prefs(ctx).getString("rows", "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String word = o.optString("word");
                if (word.length() < 2) continue;
                out.add(new Row(word, o.optInt("pts"), o.optLong("at")));
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    static boolean has(Context ctx, String word) {
        String w = Lexicon.normalize(word);
        for (Row row : load(ctx)) if (row.word.equals(w)) return true;
        return false;
    }

    /** Returns the new favorite state of the word. */
    static boolean toggle(Context ctx, String word, int pts) {
        String w = Lexicon.normalize(word);
        if (w.length() < 2) return false;
        ArrayList<Row> next = new ArrayList<>();
        boolean removed = false;
        for (Row row : load(ctx)) {
            if (row.word.equals(w)) {
                removed = true;
                continue;
            }
            next.add(row);
        }
        if (!removed) {
            next.add(0, new Row(w, pts, System.currentTimeMillis()));
            if (next.size() > MAX) next = new ArrayList<>(next.subList(0, MAX));
        }
        save(ctx, next);
        return !removed;
    }

    private static void save(Context ctx, List<Row> rows) {
        JSONArray arr = new JSONArray();
        try {
            for (Row row : rows) {
                JSONObject o = new JSONObject();
                o.put("word", row.word);
                o.put("pts", row.pts);
                o.put("at", row.at);
                arr.put(o);
            }
        } catch (Exception ignored) {
        }
        prefs(ctx).edit().putString("rows", arr.toString()).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
}
