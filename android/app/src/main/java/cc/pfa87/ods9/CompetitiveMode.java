package cc.pfa87.ods9;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.CancellationSignal;
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
import androidx.credentials.exceptions.GetCredentialCancellationException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;

final class CompetitiveMode {
    static final String WEB_CLIENT_ID =
            "617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com";
    private static final String PREFS = "verimots-prefs";
    private static final String KEY_SCOPE = "board-scope";
    private static final String KEY_BROWSER_STATE = "browser-auth-state";
    private static final String KEY_BROWSER_STARTED = "browser-auth-started";
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
    private int authGeneration;
    private boolean disposed;
    private CancellationSignal credentialCancellation;

    private boolean active() {
        return !disposed && !activity.isFinishing() && !activity.isDestroyed();
    }

    private boolean currentAuth(int generation) {
        return active() && generation == authGeneration;
    }

    void dispose() {
        disposed = true;
        authGeneration++;
        boardGeneration++;
        if (credentialCancellation != null) credentialCancellation.cancel();
        ui.removeCallbacksAndMessages(null);
    }

    CompetitiveMode(Activity activity) {
        this.activity = activity;
        RemoteApi.setSessionToken(Session.token(activity));
        RemoteApi.setSessionOwner(Session.owner(activity));
        boardAll = "all".equals(activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                .getString(KEY_SCOPE, "week"));
    }

    boolean loggedIn() {
        return Session.loggedIn(activity);
    }

    /** Guest or Google — either identity can be ranked. */
    boolean ranked() {
        return Session.hasSession(activity);
    }

    boolean guest() {
        return Session.isGuest(activity);
    }

    private boolean guestInFlight;
    private boolean sessionRefreshing;
    private boolean sessionOffline;
    private long sessionCheckedAt;
    private Runnable sessionChanged;

    void setSessionChanged(Runnable callback) { sessionChanged = callback; }
    boolean sessionOffline() { return sessionOffline; }

    private void notifySessionChanged() {
        if (active() && sessionChanged != null) sessionChanged.run();
    }

    /** Confirm saved identity without turning a network failure into a sign-out. */
    void refreshSession() {
        if (!active() || sessionRefreshing || System.currentTimeMillis() - sessionCheckedAt < 30_000) return;
        final int generation = authGeneration;
        final String requestedToken = Session.token(activity);
        if (requestedToken.isEmpty()) { ensureGuest(null); return; }
        sessionRefreshing = true;
        RemoteApi.fetchMe(requestedToken, new RemoteApi.AuthCb() {
            @Override public void ok(JSONObject user, String token) {
                sessionRefreshing = false;
                if (!currentAuth(generation) || !requestedToken.equals(Session.token(activity))) return;
                sessionCheckedAt = System.currentTimeMillis();
                sessionOffline = false;
                Session.save(activity, token, user);
                notifySessionChanged();
            }
            @Override public void error(String message) {
                sessionRefreshing = false;
                if (!currentAuth(generation) || !requestedToken.equals(Session.token(activity))) return;
                sessionCheckedAt = System.currentTimeMillis();
                if ("not_logged_in".equals(message)) {
                    signOut();
                    notifySessionChanged();
                    ensureGuest(null);
                } else {
                    sessionOffline = true;
                    notifySessionChanged();
                }
            }
        });
    }


    /** Make sure the device holds some server identity: keep the Google or
     *  guest session it has, otherwise mint a "user100001" guest. onReady
     *  runs only once a session exists. */
    void ensureGuest(Runnable onReady) {
        if (!active()) return;
        if (ranked()) {
            if (onReady != null) onReady.run();
            return;
        }
        if (guestInFlight) return;
        guestInFlight = true;
        final int generation = authGeneration;
        RemoteApi.guest(new RemoteApi.AuthCb() {
            @Override
            public void ok(JSONObject user, String sessionToken) {
                guestInFlight = false;
                if (!currentAuth(generation) || ranked()) return;
                sessionOffline = false;
                Session.save(activity, sessionToken, user);
                notifySessionChanged();
                if (onReady != null) onReady.run();
            }

            @Override
            public void error(String message) {
                guestInFlight = false;
                if (!currentAuth(generation)) return;
                sessionOffline = true;
                notifySessionChanged();
            }
        });
    }

    String userName() {
        return Session.name(activity);
    }

    String userPicture() {
        return Session.picture(activity);
    }

    void signIn(Runnable onSuccess) {
        if (!active()) return;
        authGeneration++;
        if (credentialCancellation != null) credentialCancellation.cancel();
        requestGoogle(true, onSuccess);
    }

    private void requestGoogle(boolean buttonFlow, Runnable onSuccess) {
        if (!active()) return;
        final int generation = authGeneration;
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
            credentialCancellation = new CancellationSignal();
            mgr.getCredentialAsync(
                    activity,
                    req.build(),
                    credentialCancellation,
                    androidx.core.content.ContextCompat.getMainExecutor(activity),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            if (currentAuth(generation)) handleResult(result, onSuccess, generation);
                        }

                        @Override
                        public void onError(GetCredentialException e) {
                            if (!currentAuth(generation)) return;
                            if (e instanceof GetCredentialCancellationException) return;
                            // Any button-flow failure (missing SHA-1 client, stale Play
                            // services…) retries the account bottom sheet before falling
                            // back to the browser.
                            if (buttonFlow) {
                                requestGoogle(false, onSuccess);
                                return;
                            }
                            openWebSignIn();
                        }
                    });
        } catch (Exception e) {
            if (currentAuth(generation)) openWebSignIn();
        }
    }

    void openWebSignIn() {
        if (!active()) return;
        String lang = Lang.get(activity);
        String state = BrowserAuthState.create();
        activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit()
                .putString(KEY_BROWSER_STATE, state)
                .putLong(KEY_BROWSER_STARTED, System.currentTimeMillis()).apply();
        Uri uri = Uri.parse(RemoteApi.HOST + "/auth-android.html").buildUpon()
                .appendQueryParameter("lang", lang).appendQueryParameter("state", state).build();
        // Navigate to this attempt's URL. ACTION_MAIN can restore a browser's
        // previous tab and ignore its data. Our app links exclude the auth
        // start page, so ACTION_VIEW opens the browser without an app loop.
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
        try {
            activity.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(activity, activity.getString(R.string.google_unavailable), Toast.LENGTH_LONG).show();
        }
    }

    private boolean consumeBrowserState(String state) {
        android.content.SharedPreferences prefs = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
        String expected = prefs.getString(KEY_BROWSER_STATE, "");
        long started = prefs.getLong(KEY_BROWSER_STARTED, 0);
        long now = System.currentTimeMillis();
        if (!BrowserAuthState.matches(expected, state, started, now)) return false;
        prefs.edit().remove(KEY_BROWSER_STATE).remove(KEY_BROWSER_STARTED).apply();
        return true;
    }

    void finishWebSignIn(String token, String state, Runnable onSuccess) {
        if (!active() || token == null || token.isEmpty()) return;
        if (!consumeBrowserState(state)) {
            Toast.makeText(activity, R.string.google_unavailable, Toast.LENGTH_SHORT).show();
            return;
        }
        final int generation = ++authGeneration;
        RemoteApi.fetchMe(token, new RemoteApi.AuthCb() {
            @Override
            public void ok(JSONObject user, String sessionToken) {
                if (!currentAuth(generation)) return;
                Session.save(activity, sessionToken, user);
                sessionOffline = false;
                sessionCheckedAt = System.currentTimeMillis();
                Toast.makeText(activity, activity.getString(R.string.signed_in, user.optString("name")), Toast.LENGTH_SHORT).show();
                if (onSuccess != null) onSuccess.run();
            }

            @Override
            public void error(String message) {
                if (!currentAuth(generation)) return;
                Toast.makeText(activity, R.string.google_unavailable, Toast.LENGTH_SHORT).show();
            }
        });
    }

    /** Forgets the session and every cached "me" row, so the boards repaint
     *  without a highlighted line until the next sign-in. */
    void signOut() {
        authGeneration++;
        guestInFlight = false;
        if (credentialCancellation != null) credentialCancellation.cancel();
        activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit()
                .remove(KEY_BROWSER_STATE).remove(KEY_BROWSER_STARTED).apply();
        RemoteApi.logout(Session.token(activity));
        Session.clear(activity);
        sessionCheckedAt = 0;
        sessionOffline = false;
        lastAdultMe = null;
        lastKidsMe = null;
        lastAllAdultMe = null;
        lastAllKidsMe = null;
        lastAllAdult = null;
        lastAllKids = null;
    }

    private void handleResult(GetCredentialResponse result, Runnable onSuccess, int generation) {
        ui.post(() -> {
            if (!currentAuth(generation)) return;
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
                        if (!currentAuth(generation)) return;
                        activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit()
                                .remove(KEY_BROWSER_STATE).remove(KEY_BROWSER_STARTED).apply();
                        Session.save(activity, sessionToken, user);
                        sessionOffline = false;
                        sessionCheckedAt = System.currentTimeMillis();
                        Toast.makeText(activity, activity.getString(R.string.signed_in, user.optString("name")), Toast.LENGTH_SHORT).show();
                        if (onSuccess != null) onSuccess.run();
                    }

                    @Override
                    public void error(String message) {
                        if (!currentAuth(generation)) return;
                        Toast.makeText(activity, R.string.google_unavailable, Toast.LENGTH_SHORT).show();
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
                if (!active()) return;
                currentTrailId = trailId;
                callback.onTrail(trailId, category, rack, seed);
            }

            @Override
            public void error(String message) {
                if (!active()) return;
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

    /** Points that rank a board row: server "points", or average × plays for
     *  responses that predate the field. */
    static long entryPoints(JSONObject entry) {
        if (entry == null) return 0;
        if (entry.has("points")) return Math.max(0, Math.round(entry.optDouble("points", 0)));
        double pct = entry.has("percent") ? entry.optDouble("percent") : 0;
        return Math.max(0, Math.round(pct * Math.max(1, entry.optInt("plays", 1))));
    }

    /** Re-reads the weekly board (for the stats sheet) and runs done on the UI thread. */
    void refreshWeekly(boolean kids, Runnable done) {
        final int generation = authGeneration;
        RemoteApi.fetchBoard(null, Lang.get(activity), kids, false, new RemoteApi.BoardCb() {
            @Override
            public void ok(JSONArray top, JSONObject me) {
                if (!currentAuth(generation)) return;
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
                if (!currentAuth(generation)) return;
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
        if (activity instanceof MainActivity) ((MainActivity) activity).onStandingChanged();
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
        double pct = entry.has("percent") ? entry.optDouble("percent") : 0;
        java.util.Locale locale = new java.util.Locale(Lang.get(activity));
        String pctLabel = String.format(locale, "%.1f%%", pct);
        int plays = Math.max(1, entry.optInt("plays", 1));
        // Ranking currency: the sum of the player's game percents (server
        // "points"; rebuilt from average × plays for older responses).
        long points = entry.has("points")
                ? Math.round(entry.optDouble("points", 0))
                : Math.round(pct * plays);
        String ptsLabel = java.text.NumberFormat.getIntegerInstance(locale).format(Math.max(0, points))
                + " " + activity.getString(R.string.pts_unit);
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
        // No "last word" column: it was cut on narrow screens and the board is
        // about standing, not vocabulary. The name takes the room.
        row.addView(label, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        // Points rank the row; the average (and game count) explain them.
        TextView pts = new TextView(activity);
        {
            String sub = plays == 1
                    ? pctLabel
                    : pctLabel + " · " + activity.getString(R.string.board_plays_n, plays);
            String text = ptsLabel + "\n" + sub;
            SpannableString sp = new SpannableString(text);
            int at = ptsLabel.length() + 1;
            sp.setSpan(new ForegroundColorSpan(activity.getColor(R.color.dim)), at, text.length(),
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            sp.setSpan(new RelativeSizeSpan(0.8f), at, text.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            sp.setSpan(new StyleSpan(Typeface.NORMAL), at, text.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            pts.setText(sp);
            pts.setMaxLines(2);
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
        if (!ranked()) {
            if (onDone != null) onDone.done(false);
            return;
        }
        final String scoreSession = Session.token(activity);
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
                if (scoreSession.equals(Session.token(activity))) {
                    if ("not_logged_in".equals(message)) {
                        signOut();
                        notifySessionChanged();
                        ensureGuest(null);
                    }
                    Toast.makeText(activity, activity.getString(R.string.score_local_only), Toast.LENGTH_SHORT).show();
                }
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
