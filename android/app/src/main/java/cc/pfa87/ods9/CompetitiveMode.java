package cc.pfa87.ods9;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.text.Spannable;
import android.text.SpannableString;
import android.text.TextUtils;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
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
    private static final String PREFS = "verimots-prefs";
    private static final String KEY_SCOPE = "board-scope";
    /** Rows shown before the "Voir tout · N" pill (web boardBlock limit). */
    private static final int BOARD_LIMIT = 10;

    private final Activity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private String currentTrailId;
    private LinearLayout listHost;
    private TextView titleHost;
    private JSONArray lastAdult = new JSONArray();
    private JSONArray lastKids = new JSONArray();
    private JSONObject lastAdultMe;
    private JSONObject lastKidsMe;
    // All-time boards (scope=all); null until fetched, cleared after a ranked play.
    private JSONArray lastAllAdult;
    private JSONArray lastAllKids;
    private JSONObject lastAllAdultMe;
    private JSONObject lastAllKidsMe;
    private boolean allLoading;
    private boolean boardKids;
    private boolean boardAll;
    private boolean boardExpanded;
    private int boardGeneration;

    CompetitiveMode(Activity activity) {
        this.activity = activity;
        RemoteApi.setSessionToken(Session.token(activity));
        boardAll = "all".equals(activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                .getString(KEY_SCOPE, "week"));
    }

    boolean loggedIn() {
        return Session.loggedIn(activity);
    }

    String userName() {
        return Session.name(activity);
    }

    String userPicture() {
        return Session.picture(activity);
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

    /** Forgets the session and every cached "me" row, so the boards repaint
     *  without a highlighted line until the next sign-in. */
    void signOut() {
        Session.clear(activity);
        RemoteApi.setSessionToken("");
        lastAdultMe = null;
        lastKidsMe = null;
        lastAllAdultMe = null;
        lastAllKidsMe = null;
        lastAllAdult = null;
        lastAllKids = null;
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

    // ---- Leaderboard -------------------------------------------------------

    boolean boardAll() {
        return boardAll;
    }

    /** The signed-in player's weekly row (null when absent / anonymous). */
    JSONObject weeklyMe(boolean kids) {
        return kids ? lastKidsMe : lastAdultMe;
    }

    /** Re-reads the weekly board (for the stats sheet) and runs done on the UI thread. */
    void refreshWeekly(boolean kids, Runnable done) {
        RemoteApi.fetchBoard(null, Lang.get(activity), kids, false, new RemoteApi.BoardCb() {
            @Override
            public void ok(JSONArray top, JSONObject me) {
                if (kids) {
                    lastKids = top;
                    lastKidsMe = me;
                } else {
                    lastAdult = top;
                    lastAdultMe = me;
                }
                if (done != null) done.run();
            }

            @Override
            public void error(String message) {
                if (done != null) done.run();
            }
        });
    }

    /** Drops the cached all-time boards so the next paint refetches them
     *  (called after every ranked play — the standing moved). */
    void invalidateAll() {
        lastAllAdult = null;
        lastAllKids = null;
        lastAllAdultMe = null;
        lastAllKidsMe = null;
    }

    void fetchBoard(LinearLayout boardContainer, TextView boardTitle) {
        fetchBoards(boardContainer, boardTitle, false);
    }

    void fetchBoards(LinearLayout boardContainer, TextView boardTitle, boolean kidsTab) {
        boardKids = kidsTab;
        listHost = boardContainer;
        titleHost = boardTitle;
        final int generation = ++boardGeneration;
        paintTitle();
        String lang = Lang.get(activity);
        RemoteApi.fetchBoard(null, lang, false, new RemoteApi.BoardCb() {
            @Override
            public void ok(JSONArray adultTop, JSONObject adultMe) {
                if (generation != boardGeneration) return;
                lastAdult = adultTop;
                lastAdultMe = adultMe;
                RemoteApi.fetchBoard(null, lang, true, new RemoteApi.BoardCb() {
                    @Override
                    public void ok(JSONArray kidsTop, JSONObject kidsMe) {
                        if (generation != boardGeneration) return;
                        lastKids = kidsTop;
                        lastKidsMe = kidsMe;
                        paintSelected();
                    }

                    @Override
                    public void error(String message) {
                        if (generation != boardGeneration) return;
                        lastKids = new JSONArray();
                        lastKidsMe = null;
                        paintSelected();
                    }
                });
            }

            @Override
            public void error(String message) {
                if (generation != boardGeneration) return;
                lastAdult = new JSONArray();
                lastAdultMe = null;
                lastKids = new JSONArray();
                lastKidsMe = null;
                paintSelected();
            }
        });
        if (boardAll) loadAll(kidsTab);
    }

    private void loadAll(boolean kids) {
        if (allLoading) return;
        allLoading = true;
        final int generation = boardGeneration;
        RemoteApi.fetchBoard(null, Lang.get(activity), kids, true, new RemoteApi.BoardCb() {
            @Override
            public void ok(JSONArray top, JSONObject me) {
                allLoading = false;
                if (generation != boardGeneration) return;
                if (kids) {
                    lastAllKids = top;
                    lastAllKidsMe = me;
                } else {
                    lastAllAdult = top;
                    lastAllAdultMe = me;
                }
                paintSelected();
            }

            @Override
            public void error(String message) {
                allLoading = false;
                if (generation != boardGeneration) return;
                if (kids) lastAllKids = new JSONArray();
                else lastAllAdult = new JSONArray();
                paintSelected();
            }
        });
    }

    void showBoardTab(boolean kids) {
        boardKids = kids;
        paintSelected();
    }

    /** "Semaine | Général": persisted, repaints at once, fetches the all-time
     *  board on first use (web setBoardScope). */
    void setBoardScope(boolean all) {
        boardAll = all;
        boardExpanded = false;
        activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                .edit().putString(KEY_SCOPE, all ? "all" : "week").apply();
        paintTitle();
        paintSelected();
        if (all && (boardKids ? lastAllKids : lastAllAdult) == null) loadAll(boardKids);
    }

    private void paintTitle() {
        if (titleHost == null) return;
        titleHost.setText(activity.getString(boardAll ? R.string.board_general_title : R.string.daily_board));
    }

    private void paintSelected() {
        if (listHost == null) return;
        JSONArray top;
        JSONObject me;
        if (boardAll) {
            top = boardKids ? lastAllKids : lastAllAdult;
            me = boardKids ? lastAllKidsMe : lastAllAdultMe;
            if (top == null) {
                paintNotice(listHost, activity.getString(R.string.loading));
                return;
            }
        } else {
            top = boardKids ? lastKids : lastAdult;
            me = boardKids ? lastKidsMe : lastAdultMe;
        }
        String empty = activity.getString(boardKids ? R.string.kids_board_empty : R.string.board_empty);
        paintList(listHost, top, me, empty);
    }

    private void paintNotice(LinearLayout container, String text) {
        float d = activity.getResources().getDisplayMetrics().density;
        container.setVisibility(View.VISIBLE);
        container.removeAllViews();
        TextView empty = new TextView(activity);
        empty.setText(text);
        empty.setTextColor(activity.getColor(R.color.muted));
        empty.setTextSize(13);
        empty.setPadding((int) (8 * d), (int) (10 * d), (int) (8 * d), (int) (2 * d));
        container.addView(empty);
    }

    private void paintList(LinearLayout container, JSONArray top, JSONObject me, String emptyText) {
        if (container == null) return;
        if (top == null || top.length() == 0) {
            paintNotice(container, emptyText);
            return;
        }
        container.setVisibility(View.VISIBLE);
        container.removeAllViews();
        int myRank = me != null ? me.optInt("rank", 0) : 0;
        int shown = boardExpanded ? top.length() : Math.min(BOARD_LIMIT, top.length());
        boolean meShown = false;
        for (int i = 0; i < shown; i++) {
            try {
                JSONObject entry = top.getJSONObject(i);
                boolean mine = myRank > 0 && entry.optInt("rank") == myRank;
                container.addView(boardRow(entry, mine, i + 1));
                if (mine) meShown = true;
            } catch (Exception ignored) {
            }
        }
        if (top.length() > BOARD_LIMIT) container.addView(morePill(top.length()));
        if (me != null && !meShown && myRank > shown) {
            container.addView(boardRow(me, true, 0));
        }
    }

    /** "Voir tout · N" / "Réduire" — quiet centred pill (web .board-more). */
    private View morePill(int total) {
        float d = activity.getResources().getDisplayMetrics().density;
        TextView pill = new TextView(activity);
        pill.setText(boardExpanded
                ? activity.getString(R.string.board_less)
                : activity.getString(R.string.board_more, total));
        pill.setTextColor(activity.getColor(R.color.muted));
        pill.setTextSize(11);
        pill.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        pill.setGravity(Gravity.CENTER);
        pill.setIncludeFontPadding(false);
        pill.setMinHeight((int) (28 * d));
        pill.setPadding((int) (12 * d), 0, (int) (12 * d), 0);
        pill.setBackgroundResource(R.drawable.bg_pill_quiet);
        pill.setOnClickListener(v -> {
            boardExpanded = !boardExpanded;
            paintSelected();
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        lp.topMargin = (int) (7 * d);
        lp.bottomMargin = (int) (2 * d);
        pill.setLayoutParams(lp);
        return pill;
    }

    /** One leaderboard line (web .board-row): podium badge, name, bold word,
     *  gold percent with the play count underneath. position = 1-based row
     *  index in the painted list (0 for the detached "me" row). */
    private View boardRow(JSONObject entry, boolean mine, int position) {
        float d = activity.getResources().getDisplayMetrics().density;
        String word = entry.optString("word", "");
        if ("null".equals(word)) word = "";
        double pct = entry.has("percent") ? entry.optDouble("percent") : 0;
        String pctLabel = String.format(new java.util.Locale(Lang.get(activity)), "%.1f%%", pct);
        int plays = Math.max(1, entry.optInt("plays", 1));
        int rank = entry.optInt("rank");
        String name = entry.optString("pseudo", "?");

        LinearLayout row = new LinearLayout(activity);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        int ph = (int) (12 * d);
        int pv = (int) (8 * d);
        row.setPadding(ph, pv, ph, pv);
        row.setBackgroundResource(mine ? R.drawable.bg_board_me : R.drawable.bg_board_row);
        LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rlp.topMargin = (int) (5 * d);
        row.setLayoutParams(rlp);

        // Podium: gold / silver / bronze discs with dark ink, plain otherwise.
        TextView badge = new TextView(activity);
        badge.setText(String.valueOf(rank));
        badge.setGravity(Gravity.CENTER);
        badge.setTextSize(11);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setIncludeFontPadding(false);
        badge.setMaxLines(1);
        if (position == 1) {
            badge.setBackgroundResource(R.drawable.bg_rank_gold);
            badge.setTextColor(0xFF26200C);
        } else if (position == 2) {
            badge.setBackgroundResource(R.drawable.bg_rank_silver);
            badge.setTextColor(0xFF20261F);
        } else if (position == 3) {
            badge.setBackgroundResource(R.drawable.bg_rank_bronze);
            badge.setTextColor(0xFF241608);
        } else {
            badge.setBackgroundResource(R.drawable.bg_rank_badge);
            badge.setTextColor(activity.getColor(R.color.muted));
        }
        // Three-digit ranks shrink rather than overflow the 24dp disc.
        badge.setAutoSizeTextTypeUniformWithConfiguration(8, 11, 1, TypedValue.COMPLEX_UNIT_SP);
        int bs = (int) (24 * d);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(bs, bs);
        blp.setMarginEnd((int) (10 * d));
        row.addView(badge, blp);

        TextView label = new TextView(activity);
        label.setText(name);
        label.setTextColor(activity.getColor(mine ? R.color.gold : R.color.ink));
        label.setTextSize(12.5f);
        if (mine) label.setTypeface(Typeface.DEFAULT_BOLD);
        label.setSingleLine(true);
        label.setEllipsize(TextUtils.TruncateAt.END);
        row.addView(label, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.35f));

        TextView played = new TextView(activity);
        played.setText(word);
        played.setTextColor(activity.getColor(R.color.ink));
        played.setTextSize(12.5f);
        played.setTypeface(Typeface.DEFAULT_BOLD);
        played.setLetterSpacing(0.06f);
        played.setSingleLine(true);
        played.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams wlp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.75f);
        wlp.setMarginStart((int) (10 * d));
        row.addView(played, wlp);

        TextView pts = new TextView(activity);
        if (plays > 1) {
            String sub = plays == 1
                    ? activity.getString(R.string.board_plays_one)
                    : activity.getString(R.string.board_plays_n, plays);
            String text = pctLabel + "\n" + sub;
            SpannableString sp = new SpannableString(text);
            int at = pctLabel.length() + 1;
            sp.setSpan(new ForegroundColorSpan(activity.getColor(R.color.dim)), at, text.length(),
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            sp.setSpan(new RelativeSizeSpan(0.8f), at, text.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            sp.setSpan(new StyleSpan(Typeface.NORMAL), at, text.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            pts.setText(sp);
            pts.setMaxLines(2);
        } else {
            pts.setText(pctLabel);
            pts.setSingleLine(true);
        }
        pts.setTextColor(activity.getColor(R.color.gold));
        pts.setTextSize(12.5f);
        pts.setTypeface(Typeface.DEFAULT_BOLD);
        pts.setGravity(Gravity.END);
        pts.setLineSpacing(0, 1.15f);
        LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        plp.setMarginStart((int) (10 * d));
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
