package cc.pfa87.ods9;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;
import java.util.concurrent.Executors;

final class CompetitiveMode {
    static final String WEB_CLIENT_ID =
            "617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com";

    private final Activity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private String currentTrailId;
    private LinearLayout listHost;
    private JSONArray lastAdult = new JSONArray();
    private JSONArray lastKids = new JSONArray();
    private JSONObject lastAdultMe;
    private JSONObject lastKidsMe;
    private boolean boardKids;

    CompetitiveMode(Activity activity) {
        this.activity = activity;
        RemoteApi.setSessionToken(Session.token(activity));
    }

    boolean loggedIn() {
        return Session.loggedIn(activity);
    }

    String userName() {
        return Session.name(activity);
    }

    void signIn(Runnable onSuccess) {
        requestGoogle(true, onSuccess);
    }

    private void requestGoogle(boolean buttonFlow, Runnable onSuccess) {
        try {
            CredentialManager mgr = CredentialManager.create(activity);
            GetCredentialRequest.Builder req = new GetCredentialRequest.Builder();
            if (buttonFlow) {
                req.addCredentialOption(
                        new GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID)
                                .setNonce(UUID.randomUUID().toString())
                                .build());
            } else {
                req.addCredentialOption(
                        new GetGoogleIdOption.Builder()
                                .setFilterByAuthorizedAccounts(false)
                                .setServerClientId(WEB_CLIENT_ID)
                                .setAutoSelectEnabled(false)
                                .setNonce(UUID.randomUUID().toString())
                                .build());
            }
            mgr.getCredentialAsync(
                    activity,
                    req.build(),
                    null,
                    Executors.newSingleThreadExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            handleResult(result, onSuccess);
                        }

                        @Override
                        public void onError(GetCredentialException e) {
                            // Any button-flow failure (missing SHA-1 client, stale Play
                            // services…) retries the account bottom sheet before falling
                            // back to the browser.
                            if (buttonFlow) {
                                ui.post(() -> requestGoogle(false, onSuccess));
                                return;
                            }
                            ui.post(() -> openWebSignIn());
                        }
                    });
        } catch (Exception e) {
            openWebSignIn();
        }
    }

    void openWebSignIn() {
        String lang = Lang.get(activity);
        Uri uri = Uri.parse(RemoteApi.HOST + "/auth-android.html?lang=" + lang);
        // The app claims https://s.pfa87.cc/* as an app link, so ACTION_VIEW
        // routed this URL straight back into the app and sign-in silently did
        // nothing. Target the default browser explicitly instead.
        Intent i = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_BROWSER);
        i.setData(uri);
        i.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
        try {
            activity.startActivity(i);
        } catch (Exception first) {
            try {
                Intent view = new Intent(Intent.ACTION_VIEW, uri);
                view.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                activity.startActivity(view);
            } catch (Exception e) {
                Toast.makeText(activity, activity.getString(R.string.google_unavailable), Toast.LENGTH_LONG).show();
            }
        }
    }

    void finishWebSignIn(String token, Runnable onSuccess) {
        if (token == null || token.isEmpty()) return;
        RemoteApi.fetchMe(token, new RemoteApi.AuthCb() {
            @Override
            public void ok(JSONObject user, String sessionToken) {
                Session.save(activity, sessionToken, user);
                Toast.makeText(activity, activity.getString(R.string.signed_in, user.optString("name")), Toast.LENGTH_SHORT).show();
                if (onSuccess != null) onSuccess.run();
            }

            @Override
            public void error(String message) {
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    void signOut() {
        Session.clear(activity);
        RemoteApi.setSessionToken("");
    }

    private void handleResult(GetCredentialResponse result, Runnable onSuccess) {
        ui.post(() -> {
            try {
                Credential cred = result.getCredential();
                GoogleIdTokenCredential google;
                if (cred instanceof GoogleIdTokenCredential) {
                    google = (GoogleIdTokenCredential) cred;
                } else {
                    google = GoogleIdTokenCredential.createFrom(cred.getData());
                }
                String idToken = google.getIdToken();
                RemoteApi.authGoogle(idToken, new RemoteApi.AuthCb() {
                    @Override
                    public void ok(JSONObject user, String sessionToken) {
                        Session.save(activity, sessionToken, user);
                        Toast.makeText(activity, activity.getString(R.string.signed_in, user.optString("name")), Toast.LENGTH_SHORT).show();
                        if (onSuccess != null) onSuccess.run();
                    }

                    @Override
                    public void error(String message) {
                        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
                    }
                });
            } catch (Exception e) {
                Toast.makeText(activity, activity.getString(R.string.google_bad_token), Toast.LENGTH_SHORT).show();
            }
        });
    }

    void fetchTrail(TrailCallback callback) {
        fetchTrail(false, callback);
    }

    void fetchTrail(boolean kids, TrailCallback callback) {
        RemoteApi.fetchTrail(Lang.get(activity), kids, new RemoteApi.TrailCb() {
            @Override
            public void ok(String trailId, String category, String rack) {
                ok(trailId, category, rack, "");
            }

            @Override
            public void ok(String trailId, String category, String rack, String seed) {
                currentTrailId = trailId;
                callback.onTrail(trailId, category, rack, seed);
            }

            @Override
            public void error(String message) {
                callback.onError(message);
            }
        });
    }

    void fetchBoard(LinearLayout boardContainer, TextView boardTitle) {
        fetchBoards(boardContainer, boardTitle, false);
    }

    void fetchBoards(LinearLayout boardContainer, TextView boardTitle, boolean kidsTab) {
        boardKids = kidsTab;
        listHost = boardContainer;
        if (boardTitle != null) boardTitle.setText(activity.getString(R.string.daily_board));
        String lang = Lang.get(activity);
        RemoteApi.fetchBoard(null, lang, false, new RemoteApi.BoardCb() {
            @Override
            public void ok(JSONArray adultTop, JSONObject adultMe) {
                lastAdult = adultTop;
                lastAdultMe = adultMe;
                RemoteApi.fetchBoard(null, lang, true, new RemoteApi.BoardCb() {
                    @Override
                    public void ok(JSONArray kidsTop, JSONObject kidsMe) {
                        lastKids = kidsTop;
                        lastKidsMe = kidsMe;
                        paintSelected();
                    }

                    @Override
                    public void error(String message) {
                        lastKids = new JSONArray();
                        lastKidsMe = null;
                        paintSelected();
                    }
                });
            }

            @Override
            public void error(String message) {
                lastAdult = new JSONArray();
                lastAdultMe = null;
                lastKids = new JSONArray();
                lastKidsMe = null;
                paintSelected();
            }
        });
    }

    void showBoardTab(boolean kids) {
        boardKids = kids;
        paintSelected();
    }

    private void paintSelected() {
        JSONArray top = boardKids ? lastKids : lastAdult;
        JSONObject me = boardKids ? lastKidsMe : lastAdultMe;
        String empty = activity.getString(boardKids ? R.string.kids_board_empty : R.string.board_empty);
        paintList(listHost, top, me, empty);
    }

    private void paintList(LinearLayout container, JSONArray top, JSONObject me, String emptyText) {
        if (container == null) return;
        container.setVisibility(android.view.View.VISIBLE);
        container.removeAllViews();
        if (top == null || top.length() == 0) {
            TextView empty = new TextView(activity);
            empty.setText(emptyText);
            empty.setTextColor(0xFF9AA394);
            empty.setPadding(12, 10, 12, 4);
            container.addView(empty);
            return;
        }
        int myRank = me != null ? me.optInt("rank", 0) : 0;
        boolean meShown = false;
        for (int i = 0; i < Math.min(10, top.length()); i++) {
            try {
                JSONObject entry = top.getJSONObject(i);
                container.addView(boardRow(entry, myRank > 0 && entry.optInt("rank") == myRank));
                if (myRank > 0 && entry.optInt("rank") == myRank) meShown = true;
            } catch (Exception ignored) {
            }
        }
        if (me != null && !meShown && myRank > 10) {
            container.addView(boardRow(me, true));
        }
    }

    /** One leaderboard line: round rank badge, name + word, gold score.
     *  The player's own row gets a subtle gold tint and border (no side bar). */
    private android.view.View boardRow(JSONObject entry, boolean mine) {
        float d = activity.getResources().getDisplayMetrics().density;
        String word = entry.optString("word", "");
        double pct = entry.has("percent") ? entry.optDouble("percent") : 0;
        String pctLabel = String.format(new java.util.Locale(Lang.get(activity)), "%.1f%%", pct);
        int plays = Math.max(1, entry.optInt("plays", 1));
        String words = activity.getString(R.string.word_count_n, plays, plays > 1 ? "s" : "");
        String score = activity.getString(R.string.board_score, pctLabel, words);
        int rank = entry.optInt("rank");
        String name = entry.optString("pseudo", "?");

        android.widget.LinearLayout row = new android.widget.LinearLayout(activity);
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        int ph = (int) (8 * d);
        int pv = (int) (5 * d);
        row.setPadding(ph, pv, ph, pv);
        if (mine) row.setBackgroundResource(R.drawable.bg_board_me);
        android.widget.LinearLayout.LayoutParams rlp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        rlp.topMargin = (int) (2 * d);
        row.setLayoutParams(rlp);

        // Medal-tinted rank for the podium, dim otherwise — in a round badge.
        int rankColor = rank == 1 ? 0xFFE8C56B : rank == 2 ? 0xFFB9C6BA : rank == 3 ? 0xFFCE9668 : 0xFF7D9183;
        TextView badge = new TextView(activity);
        badge.setText(String.valueOf(rank));
        badge.setGravity(android.view.Gravity.CENTER);
        badge.setTextColor(rankColor);
        badge.setTextSize(11);
        badge.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        badge.setIncludeFontPadding(false);
        badge.setBackgroundResource(R.drawable.bg_rank_badge);
        int bs = (int) (24 * d);
        android.widget.LinearLayout.LayoutParams blp = new android.widget.LinearLayout.LayoutParams(bs, bs);
        blp.setMarginEnd((int) (8 * d));
        row.addView(badge, blp);

        TextView label = new TextView(activity);
        String text = word.isEmpty() ? name : name + "  " + word;
        android.text.SpannableString sp = new android.text.SpannableString(text);
        if (!word.isEmpty()) {
            int ws = name.length() + 2;
            sp.setSpan(new android.text.style.StyleSpan(android.graphics.Typeface.BOLD), ws, ws + word.length(),
                    android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        label.setText(sp);
        label.setTextColor(mine ? 0xFFE8C56B : 0xFFF7F2E8);
        label.setTextSize(12);
        label.setSingleLine(true);
        label.setEllipsize(android.text.TextUtils.TruncateAt.END);
        row.addView(label, new android.widget.LinearLayout.LayoutParams(
                0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView pts = new TextView(activity);
        pts.setText(score);
        pts.setTextColor(0xFFE8C56B);
        pts.setTextSize(12);
        pts.setSingleLine(true);
        android.widget.LinearLayout.LayoutParams plp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        plp.setMarginStart((int) (8 * d));
        row.addView(pts, plp);
        return row;
    }

    void submitScore(int percent, String word) {
        submitScore(percent, word, false, null, null);
    }

    void submitScore(int percent, String word, boolean kids) {
        submitScore(percent, word, kids, null, null);
    }

    void submitScore(int percent, String word, boolean kids, String rack, SubmitCallback onDone) {
        submitScore(percent, word, kids, rack, false, onDone);
    }

    void submitScore(int percent, String word, boolean kids, String rack, boolean pass, SubmitCallback onDone) {
        if (!loggedIn()) {
            if (onDone != null) onDone.done(false);
            return;
        }
        RemoteApi.compete(percent, word, Lang.get(activity), kids, rack, pass, new RemoteApi.CompeteCb() {
            @Override
            public void ok() {
                Toast.makeText(activity, activity.getString(R.string.score_ranked), Toast.LENGTH_SHORT).show();
                if (onDone != null) onDone.done(true);
            }

            @Override
            public void alreadySubmitted() {
                Toast.makeText(activity, activity.getString(R.string.already_ranked), Toast.LENGTH_SHORT).show();
                if (onDone != null) onDone.done(true);
            }

            @Override
            public void error(String message) {
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
                if (onDone != null) onDone.done(false);
            }
        });
    }

    interface SubmitCallback {
        void done(boolean accepted);
    }

    interface TrailCallback {
        void onTrail(String trailId, String category, String rack);

        default void onTrail(String trailId, String category, String rack, String seed) {
            onTrail(trailId, category, rack);
        }

        void onError(String message);
    }
}
