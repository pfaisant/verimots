package cc.pfa87.ods9;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

/** Keeps explicit discoveries through a lost connection. Ids survive retries;
 *  queues stay with their session, so switching accounts cannot move activity. */
final class ActivityStore {
    private static final int MAX_PENDING_EVENTS = 200;
    private static final long MAX_PENDING_AGE_MS = 7L * 24 * 60 * 60 * 1000;
    private static boolean sending;

    private ActivityStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("verimots-activity", Context.MODE_PRIVATE);
    }

    private static String key(Context context) {
        String owner = Session.owner(context);
        if (owner.isEmpty()) return legacyKey(Session.token(context));
        return "owner-" + digest(owner);
    }

    private static String legacyKey(String token) {
        return token.isEmpty() ? "pending-guest" : "pending-" + digest(token);
    }

    private static String digest(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required", e);
        }
    }

    private static JSONArray read(Context context, String key) {
        try { return retained(new JSONArray(prefs(context).getString(key, "[]"))); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    private static JSONArray retained(JSONArray rows) {
        long now = System.currentTimeMillis();
        JSONArray out = new JSONArray();
        for (int i = Math.max(0, rows.length() - MAX_PENDING_EVENTS); i < rows.length(); i++) {
            JSONObject event = rows.optJSONObject(i);
            if (event == null) continue;
            long at = event.optLong("queuedAt", now);
            if (at <= 0 || at > now || now - at > MAX_PENDING_AGE_MS) continue;
            try { event.put("queuedAt", at); }
            catch (org.json.JSONException ignored) { continue; }
            out.put(event);
        }
        return out;
    }

    private static void write(Context context, String key, JSONArray rows) {
        JSONArray kept = retained(rows);
        SharedPreferences.Editor editor = prefs(context).edit();
        if (kept.length() == 0) editor.remove(key);
        else editor.putString(key, kept.toString());
        editor.apply();
    }

    private static void prune(Context context) {
        for (String stored : prefs(context).getAll().keySet()) {
            if (stored.startsWith("pending-") || stored.startsWith("owner-")) write(context, stored, read(context, stored));
        }
    }

    static void record(Context context, String category, String word, String rack, String roundId) {
        try {
            JSONObject event = new JSONObject();
            event.put("id", UUID.randomUUID().toString());
            event.put("queuedAt", System.currentTimeMillis());
            event.put("category", category);
            event.put("lang", Lang.get(context));
            event.put("dict", Dict.get(context));
            event.put("edition", Dict.esEdition(context));
            event.put("word", Lexicon.display(word));
            if (rack != null) event.put("rack", Lexicon.displayRackOf(rack));
            if (roundId != null) event.put("roundId", roundId);
            String key = key(context);
            JSONArray queue = read(context, key);
            queue.put(event);
            write(context, key, queue);
            flush(context);
        } catch (Exception ignored) {
        }
    }

    static void flush(Context context) {
        Context app = context.getApplicationContext();
        prune(app);
        if (sending || !Session.hasSession(app)) return;
        String key = key(app);
        JSONArray queue = read(app, key);
        // Only migrate the queue for the exact session currently authenticated.
        // Ownerless events and another account's queue are never reassigned.
        String legacy = legacyKey(Session.token(app));
        if (!legacy.equals(key)) {
            JSONArray old = read(app, legacy);
            for (int i = 0; i < queue.length(); i++) old.put(queue.opt(i));
            write(app, key, old);
            prefs(app).edit().remove(legacy).apply();
            queue = read(app, key);
        }
        JSONObject event = queue.optJSONObject(0);
        if (event == null) return;
        sending = true;
        RemoteApi.recordActivity(event, new RemoteApi.FeedbackCb() {
            @Override public void ok() { finish(true); }
            @Override public void error(String message) { finish("invalid".equals(message)); }
            private void finish(boolean remove) {
                sending = false;
                if (!remove) return; // A later action/app launch retries this same event id.
                JSONArray current = read(app, key);
                for (int i = current.length() - 1; i >= 0; i--) {
                    JSONObject row = current.optJSONObject(i);
                    if (row != null && event.optString("id").equals(row.optString("id"))) current.remove(i);
                }
                write(app, key, current);
                if (key.equals(key(app))) flush(app);
            }
        });
    }
}
