package cc.pfa87.ods9;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

final class Session {
    private static final String PREF = "verimots-auth";

    static void save(Context ctx, String token, JSONObject user) {
        SharedPreferences.Editor e = prefs(ctx).edit();
        e.putString("token", token == null ? "" : token);
        e.putString("name", user != null ? user.optString("name") : "");
        e.putString("picture", user != null ? user.optString("picture") : "");
        e.putString("sub", user != null ? user.optString("sub") : "");
        e.apply();
    }

    static void clear(Context ctx) {
        prefs(ctx).edit().clear().apply();
    }

    static boolean loggedIn(Context ctx) {
        String t = token(ctx);
        return t != null && !t.isEmpty();
    }

    static String token(Context ctx) {
        return prefs(ctx).getString("token", "");
    }

    static String name(Context ctx) {
        return prefs(ctx).getString("name", "");
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
}
