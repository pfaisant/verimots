package cc.pfa87.ods9;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

final class ScoreStore {
    private static final String KEY = "scores";
    private static final String KIDS_KEY = "kids-scores";
    private static final int MAX = 24;

    static List<Integer> load(Context ctx) {
        return load(ctx, false);
    }

    static List<Integer> load(Context ctx, boolean kids) {
        ArrayList<Integer> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(ctx).getString(kids ? KIDS_KEY : KEY, "[]"));
            for (int i = 0; i < a.length(); i++) out.add(clamp(a.optInt(i, -1)));
        } catch (Exception ignored) {
        }
        return out;
    }

    static List<Integer> add(Context ctx, int percent) {
        return add(ctx, percent, false);
    }

    static List<Integer> add(Context ctx, int percent, boolean kids) {
        List<Integer> rows = load(ctx, kids);
        rows.add(clamp(percent));
        if (rows.size() > MAX) rows = rows.subList(rows.size() - MAX, rows.size());
        JSONArray a = new JSONArray();
        for (int p : rows) a.put(p);
        prefs(ctx).edit().putString(kids ? KIDS_KEY : KEY, a.toString()).apply();
        return rows;
    }

    private static int clamp(int n) {
        if (n < 0) return 0;
        if (n > 100) return 100;
        return n;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences("verimots-scores", Context.MODE_PRIVATE);
    }
}
