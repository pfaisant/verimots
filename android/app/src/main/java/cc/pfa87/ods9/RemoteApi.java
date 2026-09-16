package cc.pfa87.ods9;

import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class RemoteApi {
    static final String HOST = "https://s.pfa87.cc";
    private static final ExecutorService IO = Executors.newCachedThreadPool();
    private static final Handler UI = new Handler(Looper.getMainLooper());
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static volatile String sessionToken = "";
    private static volatile String sessionOwner = "";
    private static String appLabel = "";

    private static String language(String lang) {
        return Lang.supported(lang) && !"fr".equals(lang) ? lang : "fr";
    }

    static void setSessionToken(String token) {
        sessionToken = token == null ? "" : token;
    }

    static void setSessionOwner(String owner) {
        sessionOwner = owner == null ? "" : owner;
    }

    static void setAppLabel(String versionName, int versionCode) {
        String name = versionName == null || versionName.isEmpty() ? "?" : versionName;
        appLabel = name + " (" + versionCode + ")";
    }

    interface DefCb {
        void ok(String pos, String text, String url, String lemma);

        void empty(String message);
    }

    interface AvgCb {
        void ok(boolean hasPlays, double average);
    }

    interface TrailCb {
        void ok(String trailId, String category, String rack);
        default void ok(String trailId, String category, String rack, String seed) {
            ok(trailId, category, rack);
        }
        void error(String message);
    }

    interface BoardCb {
        void ok(JSONArray top, JSONObject me);
        void error(String message);
    }

    interface AuthCb {
        void ok(JSONObject user, String sessionToken);
        void error(String message);
    }

    interface CompeteCb {
        void ok();
        void alreadySubmitted();
        void error(String message);
    }

    interface HistoryCb {
        void ok(JSONArray history, JSONObject stats);
        void error(String message);
    }

    static void define(String word, DefCb cb) {
        define(word, cb, "fr");
    }

    static void define(String rawWord, DefCb cb, String lang) {
        final String word = Lexicon.display(rawWord);
        IO.execute(() -> {
            try {
                String langQ = "&lang=" + language(lang);
                String q = URLEncoder.encode(word == null ? "" : word, "UTF-8").replace("+", "%20");
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/define?w=" + q + langQ).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(20000);
                c.setRequestProperty("Accept", "application/json");
                auth(c);
                int status = c.getResponseCode();
                if (status >= 400) {
                    post(() -> cb.empty("unavailable"));
                    return;
                }
                String raw = read(c);
                JSONObject o = new JSONObject(raw);
                if (o.optBoolean("unavailable", false)) {
                    post(() -> cb.empty("unavailable"));
                    return;
                }
                if (!o.optBoolean("found", false)) {
                    boolean offline = o.optBoolean("offline", false);
                    post(() -> cb.empty(offline ? "offline" : "missing"));
                    return;
                }
                JSONArray senses = o.optJSONArray("senses");
                JSONObject s0 = firstLexicalSense(senses);
                if (s0 == null) {
                    post(() -> cb.empty("missing"));
                    return;
                }
                JSONArray lemmas = o.optJSONArray("lemmas");
                boolean multiLemma = lemmas != null && lemmas.length() > 1;
                String pos = senseLabel(s0, multiLemma, word);
                String def = joinSenses(senses, word == null ? "" : word.toUpperCase(Locale.ROOT), multiLemma);
                String url = o.optString("url", "https://" + language(lang)
                        + ".wiktionary.org/wiki/" + word.toLowerCase(Locale.ROOT));
                String lemma = o.optString("lemma", "");
                post(() -> cb.ok(pos, def, url, lemma));
            } catch (Exception e) {
                post(() -> cb.empty("offline"));
            }
        });
    }

    static void fetchAverage(AvgCb cb) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/stats").openConnection();
                auth(c);
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok") && o.optInt("plays") > 0) {
                    double avg = o.optDouble("average");
                    post(() -> cb.ok(true, avg));
                } else post(() -> cb.ok(false, 0));
            } catch (Exception e) {
                post(() -> cb.ok(false, 0));
            }
        });
    }

    interface FeedbackCb {
        void ok();
        void error(String message);
    }

    static void sendFeedback(String message, String email, String lang, FeedbackCb cb) {
        IO.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("message", message == null ? "" : message);
                body.put("email", email == null ? "" : email);
                body.put("lang", language(lang));
                body.put("source", "android");
                if (appLabel != null && !appLabel.isEmpty()) body.put("app", appLabel);
                String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.trim();
                String model = Build.MODEL == null ? "" : Build.MODEL.trim();
                String device = (maker + " " + model).trim();
                if (!device.isEmpty()) {
                    String release = Build.VERSION.RELEASE == null ? "" : Build.VERSION.RELEASE;
                    body.put("device", release.isEmpty() ? device : device + " · Android " + release);
                }
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/feedback").openConnection();
                auth(c);
                c.setConnectTimeout(8000);
                c.setReadTimeout(12000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(bytes);
                }
                int code = c.getResponseCode();
                JSONObject o = new JSONObject(read(c));
                if (code >= 400 || !o.optBoolean("ok")) {
                    post(() -> cb.error(o.optString("error", "fail")));
                    return;
                }
                post(cb::ok);
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void postScore(int percent, AvgCb cb) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/score").openConnection();
                auth(c);
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                byte[] body = ("{\"percent\":" + percent + "}").getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(body);
                }
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    post(() -> cb.ok(true, o.optDouble("average")));
                }
            } catch (Exception ignored) {
            }
        });
    }

    private static void auth(HttpURLConnection c) {
        auth(c, sessionToken);
    }

    private static void auth(HttpURLConnection c, String token) {
        if (token != null && !token.isEmpty()) {
            c.setRequestProperty("Cookie", "ods9_session=" + token);
        }
    }

    private static String read(HttpURLConnection c) throws Exception {
        try (InputStream in = c.getResponseCode() >= 400 ? c.getErrorStream() : c.getInputStream()) {
            if (in == null) return "{}";
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) {
                if (bos.size() + n > MAX_RESPONSE_BYTES) throw new java.io.IOException("Response too large");
                bos.write(buf, 0, n);
            }
            return bos.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    static void fetchTrail(String lang, TrailCb cb) {
        fetchTrail(lang, false, cb);
    }

    static void fetchTrail(String lang, boolean kids, TrailCb cb) {
        IO.execute(() -> {
            try {
                String q = "?lang=" + language(lang);
                if (kids) q += "&kids=1";
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/trail" + q).openConnection();
                auth(c);
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    String trailId = o.optString("trailId");
                    String category = o.optString("category");
                    String rack = o.optString("rack");
                    String seed = o.optString("seed", "");
                    post(() -> cb.ok(trailId, category, rack, seed));
                } else post(() -> cb.error("Trail non disponible"));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void fetchBoard(String trailId, String lang, BoardCb cb) {
        fetchBoard(trailId, lang, false, cb);
    }

    static void fetchBoard(String trailId, String lang, boolean kids, BoardCb cb) {
        fetchBoard(trailId, lang, kids, false, cb);
    }

    /** all=true asks for the all-time board (scope=all): same JSON shape. */
    static void fetchBoard(String trailId, String lang, boolean kids, boolean all, BoardCb cb) {
        IO.execute(() -> {
            try {
                String url = HOST + "/api/game/board?lang=" + language(lang);
                if (kids) url += "&kids=1";
                if (all) url += "&scope=all";
                if (trailId != null && !trailId.isEmpty()) url += "&trailId=" + trailId;
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                auth(c);
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    JSONArray rawTop = o.optJSONArray("top");
                    JSONArray top = rawTop != null ? rawTop : new JSONArray();
                    JSONObject me = o.optJSONObject("me");
                    post(() -> cb.ok(top, me));
                } else post(() -> cb.error("Classement non disponible"));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void fetchCategoryBoard(String category, String lang, String scope, BoardCb cb) {
        IO.execute(() -> {
            try {
                String query = "?category=" + URLEncoder.encode(category, "UTF-8")
                        + "&lang=" + language(lang) + "&scope=" + URLEncoder.encode(scope, "UTF-8");
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/board" + query).openConnection();
                auth(c);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                JSONObject response = new JSONObject(read(c));
                if (!response.optBoolean("ok")) {
                    post(() -> cb.error("offline"));
                    return;
                }
                JSONArray top = response.optJSONArray("top");
                JSONObject me = response.optJSONObject("me");
                post(() -> cb.ok(top == null ? new JSONArray() : top, me));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    /** Explicit user actions only; the caller keeps the same id for retries. */
    static void recordActivity(JSONObject event, FeedbackCb cb) {
        final String eventSession = sessionToken;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/activity").openConnection();
                if (eventSession != null && !eventSession.isEmpty()) {
                    c.setRequestProperty("Cookie", "ods9_session=" + eventSession);
                }
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestMethod("POST");
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = c.getOutputStream()) {
                    out.write(event.toString().getBytes(StandardCharsets.UTF_8));
                }
                int status = c.getResponseCode();
                JSONObject response = new JSONObject(read(c));
                if (status < 400 && response.optBoolean("ok")) post(cb::ok);
                else post(() -> cb.error(status >= 500 || status == 429 || status == 401 ? "retry" : "invalid"));
            } catch (Exception e) {
                post(() -> cb.error("retry"));
            }
        });
    }

    static void fetchMe(String token, AuthCb cb) {
        final String requestedToken = token == null ? "" : token;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/auth/me").openConnection();
                auth(c, requestedToken);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                int status = c.getResponseCode();
                JSONObject o = new JSONObject(read(c));
                JSONObject user = o.optJSONObject("user");
                if (status == 401 || (status < 400 && o.optBoolean("ok") && user == null)) {
                    post(() -> cb.error("not_logged_in"));
                } else if (status < 400 && o.optBoolean("ok") && user != null) {
                    post(() -> cb.ok(user, requestedToken));
                } else post(() -> cb.error("offline"));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void logout(String token) {
        if (token == null || token.isEmpty()) return;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/auth/logout").openConnection();
                auth(c, token);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestMethod("POST");
                read(c);
            } catch (Exception ignored) {
                // Local sign-out remains available offline.
            }
        });
    }

    /** Mint (or re-confirm) an anonymous "user100001" identity so an
     *  unsigned player still gets a board row. Idempotent per session. */
    static void guest(AuthCb cb) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/auth/guest").openConnection();
                auth(c);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                try (OutputStream os = c.getOutputStream()) {
                    os.write("{}".getBytes(StandardCharsets.UTF_8));
                }
                JSONObject o = new JSONObject(read(c));
                JSONObject user = o.optJSONObject("user");
                String token = o.optString("sessionToken", "");
                if (o.optBoolean("ok") && user != null && !token.isEmpty()) {
                    post(() -> cb.ok(user, token));
                } else post(() -> cb.error(o.optString("error", "guest_failed")));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void authGoogle(String idToken, AuthCb cb) {
        final String requestSession = sessionToken;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/auth/google").openConnection();
                // Send the guest cookie along: the server moves the guest's
                // board rows and stats onto the Google account.
                auth(c, requestSession);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                JSONObject payload = new JSONObject();
                payload.put("idToken", idToken);
                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(body);
                }
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    JSONObject user = o.optJSONObject("user");
                    String token = o.optString("sessionToken", "");
                    if (user != null && !token.isEmpty()) {
                        post(() -> cb.ok(user, token));
                    } else post(() -> cb.error("Pas de données utilisateur"));
                } else post(() -> cb.error(o.optString("error", "Échec de l'authentification")));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void fetchHistory(HistoryCb cb) {
        final String requestSession = sessionToken;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/history").openConnection();
                auth(c, requestSession);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    JSONArray history = o.optJSONArray("history");
                    post(() -> cb.ok(history != null ? history : new JSONArray(), o.optJSONObject("stats")));
                } else post(() -> cb.error(o.optString("error", "historique indisponible")));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void clearHistory(HistoryCb cb) {
        final String requestSession = sessionToken;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/history").openConnection();
                auth(c, requestSession);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestMethod("DELETE");
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    JSONArray history = o.optJSONArray("history");
                    post(() -> cb.ok(history != null ? history : new JSONArray(), o.optJSONObject("stats")));
                } else post(() -> cb.error(o.optString("error", "historique indisponible")));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    static void saveHistory(String rawWord, int pts, String src) {
        final String word = Lexicon.display(rawWord);
        final String requestSession = sessionToken;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/history").openConnection();
                auth(c, requestSession);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                JSONObject payload = new JSONObject();
                payload.put("word", word);
                payload.put("pts", pts);
                payload.put("src", src);
                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(body);
                }
                read(c);
            } catch (Exception ignored) {
            }
        });
    }

    static void compete(int percent, String word, String lang, CompeteCb cb) {
        compete(percent, word, lang, false, null, cb);
    }

    static void compete(int percent, String word, String lang, boolean kids, CompeteCb cb) {
        compete(percent, word, lang, kids, null, cb);
    }

    static void compete(int percent, String word, String lang, boolean kids, String rack, CompeteCb cb) {
        compete(percent, word, lang, kids, rack, false, cb);
    }

    /** pass=true records a Bingo "Passer" as a 0 % play (word empty). */
    static void compete(int percent, String rawWord, String lang, boolean kids, String rawRack, boolean pass, CompeteCb cb) {
        final String word = Lexicon.display(rawWord);
        final String rack = rawRack == null ? null : Lexicon.displayRackOf(rawRack);
        final String scoreToken = sessionToken;
        final String scoreOwner = sessionOwner;
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/compete").openConnection();
                if (!scoreToken.isEmpty()) c.setRequestProperty("Cookie", "ods9_session=" + scoreToken);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                JSONObject payload = new JSONObject();
                payload.put("percent", percent);
                if (!scoreOwner.isEmpty()) payload.put("owner", scoreOwner);
                if (word != null && !word.isEmpty()) payload.put("word", word);
                else if (pass) payload.put("word", "");
                payload.put("lang", language(lang));
                if (kids) payload.put("kids", true);
                else if (pass) payload.put("kids", false);
                if (rack != null && !rack.isEmpty()) payload.put("rack", rack);
                if (pass) payload.put("pass", true);
                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(body);
                }
                int status = c.getResponseCode();
                JSONObject o = new JSONObject(read(c));
                if (status == 401) post(() -> cb.error("not_logged_in"));
                else if (o.optBoolean("ok")) post(() -> cb.ok());
                else if ("already_submitted".equals(o.optString("error"))) post(() -> cb.alreadySubmitted());
                else post(() -> cb.error(o.optString("error", "offline")));
            } catch (Exception e) {
                post(() -> cb.error("offline"));
            }
        });
    }

    private static boolean properNounPos(String pos) {
        String p = pos == null ? "" : pos.toLowerCase(Locale.ROOT);
        return p.contains("nom propre") || p.contains("proper noun") || p.contains("nombre propio");
    }

    private static JSONObject firstLexicalSense(JSONArray senses) {
        if (senses == null) return null;
        for (int i = 0; i < senses.length(); i++) {
            JSONObject sense = senses.optJSONObject(i);
            if (sense == null || properNounPos(sense.optString("pos", ""))) continue;
            JSONArray defs = sense.optJSONArray("defs");
            if (defs != null && defs.length() > 0) return sense;
        }
        return null;
    }

    /** "nom" or, when several lemmas were merged (RAPEZ: raper + râper),
     *  "nom · raper" so the header tells which entry the block belongs to. */
    private static String senseLabel(JSONObject sense, boolean multiLemma, String word) {
        String pos = sense.optString("pos", "");
        String lemma = multiLemma ? sense.optString("lemma", "") : "";
        return lemma.isEmpty() || lemma.equalsIgnoreCase(word) ? pos : pos + " · " + lemma;
    }

    /**
     * Web parity with the Vérifier page: one block per lexical sense, each
     * numbered from 1 under its own "WORD · POS" header. CHEF keeps both
     * "nom commun" senses visible, RAPEZ separates the noun (policier) from
     * the verb (chanter le rap) and from râper (fromage). The first block's
     * header is the panel title, so it is left out of the text.
     */
    private static String joinSenses(JSONArray senses, String head, boolean multiLemma) {
        java.util.ArrayList<JSONObject> lexical = new java.util.ArrayList<>();
        if (senses != null) {
            for (int i = 0; i < senses.length() && lexical.size() < 4; i++) {
                JSONObject sense = senses.optJSONObject(i);
                if (sense == null || properNounPos(sense.optString("pos", ""))) continue;
                JSONArray defs = sense.optJSONArray("defs");
                if (defs == null || defs.length() == 0) continue;
                lexical.add(sense);
            }
        }
        int perSense = lexical.size() >= 3 ? 1 : 2;
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < lexical.size(); i++) {
            JSONObject sense = lexical.get(i);
            JSONArray defs = sense.optJSONArray("defs");
            java.util.ArrayList<String> glosses = new java.util.ArrayList<>();
            for (int j = 0; defs != null && j < defs.length() && glosses.size() < perSense; j++) {
                String gloss = defs.optString(j, "").trim();
                if (!gloss.isEmpty()) glosses.add(gloss);
            }
            if (glosses.isEmpty()) continue;
            if (out.length() > 0) {
                out.append("\n\n").append(head).append(" · ")
                        .append(senseLabel(sense, multiLemma, head).toUpperCase(Locale.ROOT)).append('\n');
            }
            for (int j = 0; j < glosses.size(); j++) {
                if (j > 0) out.append('\n');
                out.append(j + 1).append(". ").append(glosses.get(j));
            }
        }
        return out.toString();
    }

    interface BitmapCb {
        void ok(android.graphics.Bitmap bitmap);
    }

    private static final java.util.Map<String, android.graphics.Bitmap> AVATARS = new java.util.HashMap<>();

    /** Google avatar for the user card / stats sheet. Cached per URL; the
     *  callback fires on the UI thread, null when the image cannot load. */
    static void fetchAvatar(String url, BitmapCb cb) {
        if (url == null || url.isEmpty() || !url.startsWith("https://")) {
            post(() -> cb.ok(null));
            return;
        }
        android.graphics.Bitmap hit;
        synchronized (AVATARS) {
            hit = AVATARS.get(url);
        }
        if (hit != null) {
            post(() -> cb.ok(hit));
            return;
        }
        IO.execute(() -> {
            android.graphics.Bitmap bmp = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                c.setInstanceFollowRedirects(true);
                try (InputStream in = c.getInputStream()) {
                    bmp = android.graphics.BitmapFactory.decodeStream(in);
                }
                c.disconnect();
            } catch (Exception ignored) {
            }
            if (bmp != null) {
                synchronized (AVATARS) {
                    AVATARS.put(url, bmp);
                }
            }
            final android.graphics.Bitmap out = bmp;
            post(() -> cb.ok(out));
        });
    }

    private static void post(Runnable r) {
        UI.post(r);
    }
}
