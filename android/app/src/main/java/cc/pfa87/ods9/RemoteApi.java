package cc.pfa87.ods9;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class RemoteApi {
    static final String HOST = "https://s.pfa87.cc";
    private static final ExecutorService IO = Executors.newCachedThreadPool();
    private static final Handler UI = new Handler(Looper.getMainLooper());
    private static String sessionToken = "";

    static void setSessionToken(String token) {
        sessionToken = token == null ? "" : token;
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
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/define?w=" + word).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestProperty("Accept", "application/json");
                auth(c);
                String raw = read(c);
                JSONObject o = new JSONObject(raw);
                if (!o.optBoolean("found", false)) {
                    boolean offline = o.optBoolean("offline", false);
                    post(() -> cb.empty(offline ? "offline" : "missing"));
                    return;
                }
                JSONArray senses = o.optJSONArray("senses");
                if (senses == null || senses.length() == 0) {
                    post(() -> cb.empty("missing"));
                    return;
                }
                JSONObject s0 = senses.getJSONObject(0);
                JSONArray defs = s0.optJSONArray("defs");
                String pos = s0.optString("pos", "");
                String def = defs != null && defs.length() > 0 ? defs.getString(0) : "";
                String url = o.optString("url", "https://fr.wiktionary.org/wiki/" + word.toLowerCase());
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
        if (sessionToken != null && !sessionToken.isEmpty()) {
            c.setRequestProperty("Cookie", "ods9_session=" + sessionToken);
        }
    }

    private static String read(HttpURLConnection c) throws Exception {
        InputStream in = c.getResponseCode() >= 400 ? c.getErrorStream() : c.getInputStream();
        if (in == null) return "{}";
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        in.close();
        c.disconnect();
        return bos.toString("UTF-8");
    }

    static void fetchTrail(TrailCb cb) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/trail").openConnection();
                auth(c);
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    String trailId = o.optString("trailId");
                    String category = o.optString("category");
                    String rack = o.optString("rack");
                    post(() -> cb.ok(trailId, category, rack));
                } else post(() -> cb.error("Trail non disponible"));
            } catch (Exception e) {
                post(() -> cb.error("Connexion requise"));
            }
        });
    }

    static void fetchBoard(String trailId, BoardCb cb) {
        IO.execute(() -> {
            try {
                String url = HOST + "/api/game/board";
                if (trailId != null && !trailId.isEmpty()) url += "?trailId=" + trailId;
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
                post(() -> cb.error("Connexion requise"));
            }
        });
    }

    static void authGoogle(String idToken, AuthCb cb) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/auth/google").openConnection();
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
                    if (user != null) {
                        setSessionToken(token);
                        post(() -> cb.ok(user, token));
                    } else post(() -> cb.error("Pas de données utilisateur"));
                } else post(() -> cb.error(o.optString("error", "Échec de l'authentification")));
            } catch (Exception e) {
                post(() -> cb.error("Connexion requise"));
            }
        });
    }

    static void fetchHistory(HistoryCb cb) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/history").openConnection();
                auth(c);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) {
                    JSONArray history = o.optJSONArray("history");
                    post(() -> cb.ok(history != null ? history : new JSONArray(), o.optJSONObject("stats")));
                } else post(() -> cb.error(o.optString("error", "historique indisponible")));
            } catch (Exception e) {
                post(() -> cb.error("Connexion requise"));
            }
        });
    }

    static void saveHistory(String word, int pts, String src) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/history").openConnection();
                auth(c);
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

    static void compete(int percent, String word, CompeteCb cb) {
        IO.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOST + "/api/game/compete").openConnection();
                auth(c);
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                String payload = "{\"percent\":" + percent;
                if (word != null && !word.isEmpty()) payload += ",\"word\":\"" + word + "\"";
                payload += "}";
                byte[] body = payload.getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(body);
                }
                JSONObject o = new JSONObject(read(c));
                if (o.optBoolean("ok")) post(() -> cb.ok());
                else if ("already_submitted".equals(o.optString("error"))) post(() -> cb.alreadySubmitted());
                else post(() -> cb.error("Échec de la soumission"));
            } catch (Exception e) {
                post(() -> cb.error("Connexion requise"));
            }
        });
    }

    private static void post(Runnable r) {
        UI.post(r);
    }
}
