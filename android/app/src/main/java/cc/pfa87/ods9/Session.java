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
        e.putBoolean("guest", user != null && user.optBoolean("guest", false));
        e.apply();
        RemoteApi.setSessionToken(token);
        RemoteApi.setSessionOwner(user != null ? user.optString("sub", "") : "");
    }

    /** Any server session at all — a Google account or an anonymous
     *  "user100001" guest. Enough to be ranked. */
    static boolean hasSession(Context ctx) {
        String t = token(ctx);
        return t != null && !t.isEmpty();
    }

    static boolean isGuest(Context ctx) {
        return hasSession(ctx) && prefs(ctx).getBoolean("guest", false);
    }

    static void clear(Context ctx) {
        prefs(ctx).edit().clear().apply();
        RemoteApi.setSessionToken("");
        RemoteApi.setSessionOwner("");
    }

    /** A real (Google) account: guests are ranked but not "connected". */
    static boolean loggedIn(Context ctx) {
        return hasSession(ctx) && !prefs(ctx).getBoolean("guest", false);
    }

    static String token(Context ctx) {
        return prefs(ctx).getString("token", "");
    }

    static String owner(Context ctx) {
        return prefs(ctx).getString("sub", "");
    }

    static String name(Context ctx) {
        return prefs(ctx).getString("name", "");
    }

    static String picture(Context ctx) {
        return prefs(ctx).getString("picture", "");
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
}
