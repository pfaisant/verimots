package cc.pfa87.ods9;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class HistoryStore {
    private static final String PREF = "verimots-history";
    private static final int MAX = 80;

    static final class Row {
        final String word;
        final int pts;
        final String src;
        final long at;

        Row(String word, int pts, String src, long at) {
            this.word = word;
            this.pts = pts;
            this.src = src;
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
                out.add(new Row(word, o.optInt("pts"), o.optString("src", "dico"), o.optLong("at")));
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    static void clear(Context ctx) {
        save(ctx, new ArrayList<>());
    }

    static void remember(Context ctx, String word, int pts, String src) {
        String w = Lexicon.normalize(word);
        if (w.length() < 2) return;
        ArrayList<Row> next = new ArrayList<>();
        next.add(new Row(w, pts, "dico".equals(src) ? "dico" : "defi", System.currentTimeMillis()));
        for (Row row : load(ctx)) if (!row.word.equals(w)) next.add(row);
        if (next.size() > MAX) next = new ArrayList<>(next.subList(0, MAX));
        save(ctx, next);
    }

    static void merge(Context ctx, JSONArray remote) {
        if (remote == null) return;
        ArrayList<Row> merged = new ArrayList<>(load(ctx));
        try {
            for (int i = 0; i < remote.length(); i++) {
                JSONObject o = remote.getJSONObject(i);
                String word = Lexicon.normalize(o.optString("word"));
                if (word.length() < 2) continue;
                boolean seen = false;
                for (int j = 0; j < merged.size(); j++) {
                    if (merged.get(j).word.equals(word)) {
                        if (o.optLong("at") > merged.get(j).at) {
                            merged.set(j, new Row(word, o.optInt("pts"), o.optString("src", "dico"), o.optLong("at")));
                        }
                        seen = true;
                        break;
                    }
                }
                if (!seen) merged.add(new Row(word, o.optInt("pts"), o.optString("src", "dico"), o.optLong("at")));
            }
        } catch (Exception ignored) {
        }
        merged.sort((a, b) -> Long.compare(b.at, a.at));
        if (merged.size() > MAX) merged = new ArrayList<>(merged.subList(0, MAX));
        save(ctx, merged);
    }

    private static void save(Context ctx, List<Row> rows) {
        JSONArray arr = new JSONArray();
        try {
            for (Row row : rows) {
                JSONObject o = new JSONObject();
                o.put("word", row.word);
                o.put("pts", row.pts);
                o.put("src", row.src);
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
