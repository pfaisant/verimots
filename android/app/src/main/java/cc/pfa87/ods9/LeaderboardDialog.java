package cc.pfa87.ods9;

import android.app.Activity;
import android.app.Dialog;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.AbsoluteSizeSpan;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Locale;

/**
 * The web leaderboard (dashboard/s/leaderboard.js) in a native dialog: the same
 * three filters — board language, category, period — the same defaults (all
 * languages, all activities, last 7 days) and the same /api/game/board request.
 * Filters are remembered between openings.
 */
final class LeaderboardDialog extends Dialog {
    static final String[] BOARDS = {"any", "fr", "en", "es", "ca"};
    private static final int[] BOARD_LABELS = {R.string.lb_lang_any, R.string.lb_lang_fr,
            R.string.lb_lang_en, R.string.lb_lang_es, R.string.lb_lang_ca};
    static final String[] CATEGORIES = {"combined", "checks", "bingo", "kids", "find", "training"};
    private static final int[] LABELS = {R.string.lb_combined, R.string.board_checks,
            R.string.menu_comp, R.string.level_beginner, R.string.menu_find, R.string.menu_training};
    private static final int[] ICONS = {R.drawable.ic_tab_game, R.drawable.ic_check,
            R.drawable.ic_tab_board, R.drawable.ic_book, R.drawable.ic_tab_check, R.drawable.ic_combinations};
    /** Breakdown order of the combined board, as on the web. */
    private static final String[] PARTS = {"checks", "find", "training", "bingo", "kids"};
    private static final int[] PART_LABELS = {R.string.lb_short_checks, R.string.lb_short_find,
            R.string.lb_short_training, R.string.lb_short_bingo, R.string.lb_short_kids};
    static final String[] SCOPES = {"day", "3d", "week", "7d", "30d", "all"};
    private static final int[] SCOPE_LABELS = {R.string.lb_scope_day, R.string.lb_scope_3d, R.string.lb_scope_week,
            R.string.lb_scope_7d, R.string.lb_scope_30d, R.string.lb_scope_all};
    private static final int[] SCOPE_RULES = {R.string.lb_rule_day, R.string.lb_rule_3d, R.string.lb_rule_week,
            R.string.lb_rule_7d, R.string.lb_rule_30d, R.string.lb_rule_all};
    private static final String PREFS = "verimots-prefs";

    private final Activity activity;
    /** Opens the game behind a category ("checks" → Check, "bingo" → Bingo…). */
    private final java.util.function.Consumer<String> onPlay;
    private final LinearLayout list;
    private final TextView rule;
    private final TextView summary;
    private final ScrollView scroll;
    private final LinearLayout footer;
    private final TextView pageLabel;
    private final TextView personal;
    private final ImageButton previous;
    private final ImageButton next;
    private final ImageButton reload;
    private final Spinner boardPicker;
    private final Spinner categoryPicker;
    private final Spinner scopePicker;
    private final LinearLayout pair;
    private final ArrayList<JSONObject> entries = new ArrayList<>();
    private final ArrayList<JSONObject> mine = new ArrayList<>();
    private int selectedBoard;
    private int selectedCategory;
    private int selectedScope;
    private int total;
    private int page;
    private int pageSize = 4;
    private int generation;
    private final View.OnLayoutChangeListener boundsChanged = (view, left, top, right, bottom,
            oldLeft, oldTop, oldRight, oldBottom) -> {
        if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) resizeWindow();
    };

    LeaderboardDialog(Activity activity, java.util.function.Consumer<String> onPlay) {
        super(activity);
        this.activity = activity;
        this.onPlay = onPlay;
        SharedPreferences prefs = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
        selectedBoard = indexOf(BOARDS, prefs.getString("lb.board", "any"));
        selectedCategory = indexOf(CATEGORIES, prefs.getString("lb.category", "combined"));
        selectedScope = indexOf(SCOPES, prefs.getString("lb.scope", "7d"));

        LinearLayout root = column();
        root.setBackgroundResource(R.drawable.bg_card);
        root.setPadding(dp(16), dp(10), dp(8), dp(8));
        LinearLayout head = row();
        TextView title = text(activity.getString(R.string.lb_title), 20, R.color.ink);
        title.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        if (android.os.Build.VERSION.SDK_INT >= 28) title.setAccessibilityHeading(true);
        head.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        reload = action(R.drawable.ic_refresh, R.string.board_refresh_action);
        reload.setOnClickListener(v -> refresh());
        head.addView(reload, new LinearLayout.LayoutParams(dp(48), dp(48)));
        ImageButton close = action(R.drawable.ic_clear, R.string.close_dialog);
        close.setOnClickListener(v -> dismiss());
        head.addView(close, new LinearLayout.LayoutParams(dp(48), dp(48)));
        root.addView(head);

        // One touch-scroll surface keeps every filter reachable in landscape.
        scroll = new ScrollView(activity);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        scroll.setFillViewport(true);
        LinearLayout body = column();
        body.setPadding(0, 0, dp(8), 0);
        scroll.addView(body);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        // Category on its own line, then language and period side by side:
        // three dropdowns in one row truncate every label on a phone.
        categoryPicker = picker(LABELS, selectedCategory, R.string.lb_filter_category, position -> {
            selectedCategory = position;
            remember("lb.category", CATEGORIES[position]);
        });
        categoryPicker.setId(R.id.board_compact_category);
        body.addView(filter(R.string.lb_filter_category, categoryPicker), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        pair = row();
        pair.setGravity(Gravity.TOP);
        boardPicker = picker(BOARD_LABELS, selectedBoard, R.string.lb_filter_lang, position -> {
            selectedBoard = position;
            remember("lb.board", BOARDS[position]);
        });
        boardPicker.setId(R.id.board_compact_lang);
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        half.setMarginEnd(dp(8));
        pair.addView(filter(R.string.lb_filter_lang, boardPicker), half);
        scopePicker = picker(SCOPE_LABELS, selectedScope, R.string.lb_filter_period, position -> {
            selectedScope = position;
            remember("lb.scope", SCOPES[position]);
        });
        scopePicker.setId(R.id.board_compact_period);
        pair.addView(filter(R.string.lb_filter_period, scopePicker),
                new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout.LayoutParams pairParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pairParams.topMargin = dp(8);
        body.addView(pair, pairParams);

        rule = text("", 12, R.color.muted);
        rule.setLineSpacing(dp(2), 1f);
        rule.setPadding(0, dp(12), 0, dp(6));
        body.addView(rule);
        summary = text("", 12, R.color.muted);
        summary.setCompoundDrawablePadding(dp(8));
        summary.setGravity(Gravity.CENTER_VERTICAL);
        summary.setLineSpacing(dp(2), 1f);
        summary.setPadding(0, dp(4), 0, dp(10));
        body.addView(summary);
        View rule2 = new View(activity);
        rule2.setBackgroundColor(activity.getColor(R.color.line));
        body.addView(rule2, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        list = column();
        body.addView(list);

        footer = column();
        footer.setPadding(0, dp(4), dp(8), 0);
        personal = text("", 13, R.color.muted);
        personal.setGravity(Gravity.CENTER);
        personal.setPadding(dp(4), dp(6), dp(4), dp(2));
        footer.addView(personal);
        LinearLayout pages = row();
        previous = action(R.drawable.ic_next, R.string.board_previous_page);
        previous.setRotation(180);
        previous.setOnClickListener(v -> changePage(-1));
        pages.addView(previous, new LinearLayout.LayoutParams(dp(48), dp(48)));
        pageLabel = text("", 12, R.color.muted);
        pageLabel.setGravity(Gravity.CENTER);
        pageLabel.setFontFeatureSettings("tnum");
        pageLabel.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        pages.addView(pageLabel, new LinearLayout.LayoutParams(0, dp(48), 1));
        next = action(R.drawable.ic_next, R.string.board_next_page);
        next.setOnClickListener(v -> changePage(1));
        pages.addView(next, new LinearLayout.LayoutParams(dp(48), dp(48)));
        footer.addView(pages);
        footer.setVisibility(View.GONE);
        root.addView(footer);
        setContentView(root);
    }

    @Override public void show() {
        super.show();
        resizeWindow();
        refresh();
    }

    @Override protected void onStart() {
        super.onStart();
        activity.getWindow().getDecorView().addOnLayoutChangeListener(boundsChanged);
    }

    @Override protected void onStop() {
        activity.getWindow().getDecorView().removeOnLayoutChangeListener(boundsChanged);
        generation++;
        super.onStop();
    }

    private void resizeWindow() {
        if (!isShowing() || activity.isFinishing() || activity.isDestroyed()) return;
        Window window = getWindow();
        if (window == null) return;
        window.setBackgroundDrawableResource(android.R.color.transparent);
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
        // Use the currently visible window, including split screen/landscape.
        android.graphics.Rect visible = new android.graphics.Rect();
        activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(visible);
        int width = visible.width() > 0 ? visible.width() : activity.getResources().getDisplayMetrics().widthPixels;
        int height = visible.height() > 0 ? visible.height() : activity.getResources().getDisplayMetrics().heightPixels;
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            android.view.WindowMetrics metrics = activity.getWindowManager().getCurrentWindowMetrics();
            android.graphics.Insets bars = metrics.getWindowInsets().getInsetsIgnoringVisibility(
                    android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
            width = metrics.getBounds().width() - bars.left - bars.right;
            height = metrics.getBounds().height() - bars.top - bars.bottom;
        }
        window.setLayout(Math.max(1, Math.min(width - dp(24), dp(560))), Math.max(1, height - dp(24)));
        // Below ~360 dp two dropdowns side by side cut "30 derniers jours": stack them.
        boolean narrow = Math.min(width - dp(24), dp(560)) < dp(360);
        if ((pair.getOrientation() == LinearLayout.VERTICAL) != narrow) {
            pair.setOrientation(narrow ? LinearLayout.VERTICAL : LinearLayout.HORIZONTAL);
            for (int i = 0; i < pair.getChildCount(); i++) {
                LinearLayout.LayoutParams cell = narrow
                        ? new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                        : new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
                if (narrow && i > 0) cell.topMargin = dp(8);
                if (!narrow && i == 0) cell.setMarginEnd(dp(8));
                pair.getChildAt(i).setLayoutParams(cell);
            }
        }
        // Rows are about 76 dp; the header, filters and footer take ~330 dp.
        int heightDp = Math.round(height / activity.getResources().getDisplayMetrics().density);
        int nextSize = Math.max(2, Math.min(10, (heightDp - (narrow ? 400 : 330)) / 76));
        if (nextSize != pageSize) {
            page = page * pageSize / nextSize;
            pageSize = nextSize;
            if (!entries.isEmpty()) renderEntries();
        }
    }

    void refresh() {
        if (!isShowing() || activity.isFinishing() || activity.isDestroyed()) return;
        entries.clear();
        mine.clear();
        page = 0;
        final int request = ++generation;
        final String category = CATEGORIES[selectedCategory];
        rule.setText(combined() ? R.string.lb_rule_combined
                : counts() ? ("checks".equals(category) ? R.string.lb_rule_checks : R.string.lb_rule_games)
                : SCOPE_RULES[selectedScope]);
        paintSummary(-1);
        reload.setEnabled(false);
        reload.setAlpha(0.45f);
        notice(activity.getString(R.string.loading), false, true);
        RemoteApi.fetchLeaderboard(category, BOARDS[selectedBoard], SCOPES[selectedScope], new RemoteApi.LeaderboardCb() {
            @Override public void ok(JSONObject response) {
                if (!alive(request)) return;
                finishLoading();
                JSONArray top = response.optJSONArray("top");
                JSONArray own = response.optJSONArray("mine");
                JSONObject me = response.optJSONObject("me");
                if (own != null) {
                    for (int i = 0; i < own.length(); i++) if (own.optJSONObject(i) != null) mine.add(own.optJSONObject(i));
                } else if (me != null) mine.add(me);
                if (top != null) {
                    for (int i = 0; i < top.length(); i++) if (top.optJSONObject(i) != null) entries.add(top.optJSONObject(i));
                }
                total = response.has("total") ? response.optInt("total") : entries.size();
                paintSummary(total);
                if (entries.isEmpty()) {
                    notice(activity.getString(R.string.board_activity_empty), false, false);
                    if (onPlay != null) {
                        // Web parity: an empty board invites you to play (lb-play-link).
                        TextView play = text(activity.getString(R.string.lb_empty_play) + " →", 14, R.color.gold);
                        play.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
                        play.setMinHeight(dp(48));
                        play.setGravity(Gravity.CENTER);
                        play.setBackgroundResource(R.drawable.bg_pill);
                        play.setPadding(dp(20), 0, dp(20), 0);
                        play.setFocusable(true);
                        play.setOnClickListener(v -> {
                            String category = CATEGORIES[selectedCategory];
                            dismiss();
                            onPlay.accept(category);
                        });
                        LinearLayout state = (LinearLayout) list.getChildAt(0);
                        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                        params.gravity = Gravity.CENTER_HORIZONTAL;
                        state.addView(play, params);
                    }
                    return;
                }
                renderEntries();
            }
            @Override public void error(String message) {
                if (!alive(request)) return;
                finishLoading();
                notice(activity.getString(R.string.board_connection_error), true, false);
            }
        });
    }

    private boolean alive(int request) {
        return isShowing() && !activity.isFinishing() && !activity.isDestroyed() && request == generation;
    }

    private boolean combined() { return "combined".equals(CATEGORIES[selectedCategory]); }
    private boolean counts() {
        String category = CATEGORIES[selectedCategory];
        return !"bingo".equals(category) && !"kids".equals(category);
    }
    private boolean anyLanguage() { return selectedBoard == 0; }

    /** "🌐 All languages · All activities · Last 7 days · 14 standings", as on the web. */
    private void paintSummary(int count) {
        SpannableStringBuilder line = new SpannableStringBuilder();
        String board = activity.getString(BOARD_LABELS[selectedBoard]);
        line.append(board);
        line.setSpan(new ForegroundColorSpan(activity.getColor(R.color.ink)), 0, board.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        line.setSpan(new android.text.style.StyleSpan(Typeface.BOLD), 0, board.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        line.append("  ·  ").append(activity.getString(LABELS[selectedCategory]));
        line.append("  ·  ").append(activity.getString(SCOPE_LABELS[selectedScope]));
        if (count >= 0) {
            line.append("  ·  ").append(NumberFormat.getIntegerInstance(locale()).format(count)).append(' ')
                    .append(activity.getString(anyLanguage() ? R.string.lb_positions : R.string.lb_published));
        }
        summary.setText(line);
        Drawable flag = activity.getDrawable(flagFor(BOARDS[selectedBoard])).mutate();
        if (anyLanguage()) {
            flag.setTint(activity.getColor(R.color.gold));
            flag.setBounds(0, 0, dp(16), dp(16));
        } else {
            flag.setBounds(0, 0, dp(18), dp(12));
        }
        summary.setCompoundDrawablesRelative(flag, null, null, null);
    }

    private void finishLoading() {
        reload.setEnabled(true);
        reload.setAlpha(1f);
    }

    private void changePage(int direction) {
        page += direction;
        renderEntries();
        scroll.post(() -> scroll.smoothScrollTo(0, list.getTop()));
    }

    private void renderEntries() {
        list.removeAllViews();
        int pages = Math.max(1, (entries.size() + pageSize - 1) / pageSize);
        page = Math.max(0, Math.min(page, pages - 1));
        for (int i = page * pageSize; i < Math.min(entries.size(), (page + 1) * pageSize); i++) {
            addEntry(entries.get(i));
        }
        // My own rows stay visible under the page, like the web board.
        for (JSONObject own : mine) {
            boolean listed = false;
            for (JSONObject entry : entries) if (same(entry, own)) { listed = true; break; }
            if (!listed) addEntry(own);
        }
        footer.setVisibility(View.VISIBLE);
        JSONObject first = mine.isEmpty() ? null : mine.get(0);
        personal.setVisibility(first == null ? View.GONE : View.VISIBLE);
        if (first != null) {
            String place = activity.getString(R.string.lb_place, first.optInt("rank"), valueWithUnit(first));
            SpannableStringBuilder styled = new SpannableStringBuilder(place);
            int hash = place.indexOf('#');
            if (hash >= 0) {
                int end = place.indexOf(' ', hash);
                styled.setSpan(new ForegroundColorSpan(activity.getColor(R.color.gold)), hash, end < 0 ? place.length() : end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                styled.setSpan(new android.text.style.StyleSpan(Typeface.BOLD), hash, end < 0 ? place.length() : end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            personal.setText(styled);
        }
        previous.setEnabled(page > 0);
        previous.setAlpha(page > 0 ? 1f : 0.25f);
        next.setEnabled(page + 1 < pages);
        next.setAlpha(page + 1 < pages ? 1f : 0.25f);
        previous.setVisibility(pages > 1 ? View.VISIBLE : View.INVISIBLE);
        next.setVisibility(pages > 1 ? View.VISIBLE : View.INVISIBLE);
        pageLabel.setText(pages > 1 ? activity.getString(R.string.board_page_number, page + 1, pages) : "");
    }

    private void notice(String message, boolean retry, boolean loading) {
        list.removeAllViews();
        footer.setVisibility(View.GONE);
        LinearLayout state = column();
        state.setGravity(Gravity.CENTER);
        state.setPadding(dp(12), dp(28), dp(12), dp(24));
        if (loading) {
            ProgressBar spinner = new ProgressBar(activity);
            spinner.setIndeterminateTintList(ColorStateList.valueOf(activity.getColor(R.color.gold)));
            state.addView(spinner, new LinearLayout.LayoutParams(dp(28), dp(28)));
        } else {
            ImageView glyph = new ImageView(activity);
            glyph.setImageResource(retry ? R.drawable.ic_refresh : ICONS[selectedCategory]);
            glyph.setImageTintList(ColorStateList.valueOf(activity.getColor(R.color.gold)));
            glyph.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            state.addView(glyph, new LinearLayout.LayoutParams(dp(32), dp(32)));
        }
        TextView line = text(message, 14, R.color.muted);
        line.setGravity(Gravity.CENTER);
        line.setPadding(dp(4), dp(16), dp(4), dp(12));
        line.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        state.addView(line);
        if (retry) {
            TextView button = text(activity.getString(R.string.retry_action), 14, R.color.gold);
            button.setMinHeight(dp(48));
            button.setGravity(Gravity.CENTER);
            button.setBackgroundResource(R.drawable.bg_pill);
            button.setOnClickListener(v -> refresh());
            button.setFocusable(true);
            state.addView(button, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        list.addView(state);
    }

    private void addEntry(JSONObject entry) {
        boolean own = false;
        for (JSONObject m : mine) if (same(entry, m)) { own = true; break; }
        LinearLayout card = column();
        card.setPadding(dp(8), dp(10), dp(8), dp(10));
        card.setMinimumHeight(dp(56));
        card.setGravity(Gravity.CENTER_VERTICAL);
        if (own) card.setBackgroundResource(R.drawable.board_compact_mine);
        LinearLayout line = row();
        int rank = entry.optInt("rank");
        TextView badge = text(String.valueOf(rank), 12, rank >= 1 && rank <= 3 ? R.color.tile_ink : R.color.muted);
        badge.setGravity(Gravity.CENTER);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setFontFeatureSettings("tnum");
        badge.setBackgroundResource(rank == 1 ? R.drawable.bg_rank_gold : rank == 2 ? R.drawable.bg_rank_silver
                : rank == 3 ? R.drawable.bg_rank_bronze : R.drawable.bg_rank_badge);
        badge.setAutoSizeTextTypeUniformWithConfiguration(8, 12, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
        line.addView(badge, new LinearLayout.LayoutParams(dp(26), dp(26)));
        String rowLang = entry.optString("lang", "");
        int indent = 26 + 10;
        if (anyLanguage() && Lang.supported(rowLang)) {
            ImageView flag = new ImageView(activity);
            flag.setImageResource(flagFor(rowLang));
            flag.setContentDescription(activity.getString(BOARD_LABELS[indexOf(BOARDS, rowLang)]));
            LinearLayout.LayoutParams flagParams = new LinearLayout.LayoutParams(dp(21), dp(14));
            flagParams.setMarginStart(dp(10));
            line.addView(flag, flagParams);
            indent += 21 + 10;
        }
        TextView name = text(entry.optString("pseudo", "?"), 14, own ? R.color.gold : R.color.ink);
        name.setTypeface(Typeface.create("sans-serif-medium", own ? Typeface.BOLD : Typeface.NORMAL));
        name.setSingleLine(true);
        name.setEllipsize(TextUtils.TruncateAt.END);
        name.setPadding(dp(10), 0, dp(8), 0);
        line.addView(name, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView value = text("", 16, R.color.gold);
        value.setText(scoreText(entry));
        value.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        value.setTypeface(Typeface.DEFAULT_BOLD);
        value.setFontFeatureSettings("tnum");
        value.setSingleLine(true);
        line.addView(value, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(28)));
        card.addView(line);
        String sub = detail(entry);
        if (!sub.isEmpty()) {
            TextView extra = text(sub, 11, R.color.dim);
            extra.setPadding(dp(indent), dp(3), 0, 0);
            extra.setLineSpacing(dp(2), 1f);
            extra.setMaxLines(2);
            extra.setEllipsize(TextUtils.TruncateAt.END);
            card.addView(extra);
        }
        card.setContentDescription(rank + ". " + entry.optString("pseudo") + ", " + valueWithUnit(entry)
                + (sub.isEmpty() ? "" : ". " + sub));
        list.addView(card, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        View divider = new View(activity);
        divider.setBackgroundColor(activity.getColor(R.color.line));
        list.addView(divider, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
    }

    /** Combined: "Found 25 · Combinations 12 · Bingo 13"; Bingo: "85 % · 139 games". */
    private String detail(JSONObject entry) {
        NumberFormat integer = NumberFormat.getIntegerInstance(locale());
        if (combined()) {
            JSONObject breakdown = entry.optJSONObject("breakdown");
            if (breakdown == null) return "";
            StringBuilder parts = new StringBuilder();
            for (int i = 0; i < PARTS.length; i++) {
                long n = breakdown.optLong(PARTS[i]);
                if (n <= 0) continue;
                if (parts.length() > 0) parts.append(" · ");
                parts.append(activity.getString(PART_LABELS[i])).append(' ').append(integer.format(n));
            }
            return parts.toString();
        }
        if (counts()) return "";
        int plays = Math.max(1, entry.optInt("plays", 1));
        return integer.format(Math.round(entry.optDouble("percent"))) + " % · "
                + (plays == 1 ? activity.getString(R.string.board_plays_one) : activity.getString(R.string.board_plays_n, plays));
    }

    private long value(JSONObject entry) {
        if (counts()) return Math.max(0, entry.optLong("count"));
        if (entry.has("points")) return Math.max(0, Math.round(entry.optDouble("points")));
        return Math.max(0, Math.round(entry.optDouble("percent") * Math.max(1, entry.optInt("plays", 1))));
    }

    private String unit(long n) {
        if (!counts()) return activity.getString(R.string.pts_unit);
        String counted = activity.getResources().getQuantityString(combined() ? R.plurals.board_activities_count
                : R.plurals.board_words_count, n == 1 ? 1 : 2, "");
        return counted.trim();
    }

    private CharSequence scoreText(JSONObject entry) {
        long n = value(entry);
        String number = NumberFormat.getIntegerInstance(locale()).format(n);
        SpannableStringBuilder text = new SpannableStringBuilder(number);
        int start = text.length();
        text.append(' ').append(unit(n));
        text.setSpan(new AbsoluteSizeSpan(11, true), start, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        text.setSpan(new ForegroundColorSpan(activity.getColor(R.color.muted)), start, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return text;
    }

    private String valueWithUnit(JSONObject entry) {
        long n = value(entry);
        return NumberFormat.getIntegerInstance(locale()).format(n) + " " + unit(n);
    }

    private static boolean same(JSONObject a, JSONObject b) {
        return a != null && b != null && a.optInt("rank") == b.optInt("rank")
                && a.optString("lang", "").equals(b.optString("lang", ""));
    }

    static int flagFor(String lang) {
        switch (lang) {
            case "fr": return R.drawable.flag_fr;
            case "en": return R.drawable.flag_en;
            case "es": return R.drawable.flag_es;
            case "ca": return R.drawable.flag_ca;
            default: return R.drawable.ic_globe;
        }
    }

    private static int indexOf(String[] values, String value) {
        for (int i = 0; i < values.length; i++) if (values[i].equals(value)) return i;
        return 0;
    }

    private void remember(String key, String value) {
        activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit().putString(key, value).apply();
    }

    private Locale locale() { return new Locale(Lang.get(activity)); }

    private interface Pick { void chosen(int position); }

    private LinearLayout filter(int label, Spinner picker) {
        LinearLayout cell = column();
        TextView caption = text(activity.getString(label), 11, R.color.muted);
        caption.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        caption.setSingleLine(true);
        caption.setEllipsize(TextUtils.TruncateAt.END);
        caption.setPadding(dp(2), 0, 0, dp(5));
        caption.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        cell.addView(caption);
        cell.addView(picker, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        return cell;
    }

    private Spinner picker(int[] labels, int selected, int description, Pick pick) {
        Spinner picker = new Spinner(activity, Spinner.MODE_DROPDOWN);
        picker.setBackgroundResource(R.drawable.board_compact_picker);
        picker.setPopupBackgroundResource(R.drawable.board_compact_popup);
        picker.setPadding(0, 0, 0, 0);
        picker.setPrompt(activity.getString(description));
        String[] values = new String[labels.length];
        for (int i = 0; i < labels.length; i++) values[i] = activity.getString(labels[i]);
        picker.setAdapter(new ArrayAdapter<String>(activity, android.R.layout.simple_spinner_item, values) {
            @Override public View getView(int position, View recycled, ViewGroup parent) {
                TextView label = text(getItem(position), 13, R.color.ink);
                label.setGravity(Gravity.CENTER_VERTICAL);
                label.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
                label.setSingleLine(true);
                label.setEllipsize(TextUtils.TruncateAt.END);
                label.setPadding(dp(12), 0, dp(10), 0);
                label.setMinHeight(dp(48));
                Drawable chevron = activity.getDrawable(R.drawable.ic_chevron_down).mutate();
                chevron.setTint(activity.getColor(R.color.muted));
                chevron.setBounds(0, 0, dp(16), dp(16));
                label.setCompoundDrawablesRelative(null, null, chevron, null);
                label.setCompoundDrawablePadding(dp(6));
                return label;
            }
            @Override public View getDropDownView(int position, View recycled, ViewGroup parent) {
                TextView label = text(getItem(position), 14, R.color.ink);
                label.setGravity(Gravity.CENTER_VERTICAL);
                label.setPadding(dp(14), dp(12), dp(14), dp(12));
                label.setMinHeight(dp(48));
                label.setMaxLines(2);
                label.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
                boolean checked = position == picker.getSelectedItemPosition();
                label.setActivated(checked);
                label.setBackgroundResource(checked ? R.drawable.board_compact_mine : 0);
                if (checked) {
                    Drawable check = activity.getDrawable(R.drawable.ic_check).mutate();
                    check.setTint(activity.getColor(R.color.gold));
                    check.setBounds(0, 0, dp(18), dp(18));
                    label.setCompoundDrawablesRelative(null, null, check, null);
                    label.setCompoundDrawablePadding(dp(12));
                }
                return label;
            }
        });
        picker.setSelection(selected, false);
        picker.setContentDescription(activity.getString(description) + ": " + values[selected]);
        picker.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            private int current = selected;
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                picker.setContentDescription(activity.getString(description) + ": " + values[position]);
                if (current == position) return;
                current = position;
                pick.chosen(position);
                refresh();
            }
            @Override public void onNothingSelected(AdapterView<?> parent) { }
        });
        return picker;
    }

    private LinearLayout column() {
        LinearLayout view = new LinearLayout(activity);
        view.setOrientation(LinearLayout.VERTICAL);
        return view;
    }
    private LinearLayout row() {
        LinearLayout view = new LinearLayout(activity);
        view.setOrientation(LinearLayout.HORIZONTAL);
        view.setGravity(Gravity.CENTER_VERTICAL);
        return view;
    }
    private TextView text(String value, float size, int color) {
        TextView view = new TextView(activity);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(activity.getColor(color));
        view.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        view.setIncludeFontPadding(false);
        return view;
    }
    private ImageButton action(int icon, int description) {
        ImageButton view = new ImageButton(activity);
        view.setImageResource(icon);
        view.setImageTintList(ColorStateList.valueOf(activity.getColor(R.color.gold)));
        android.util.TypedValue background = new android.util.TypedValue();
        activity.getTheme().resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, background, true);
        view.setBackgroundResource(background.resourceId);
        view.setPadding(dp(13), dp(13), dp(13), dp(13));
        view.setContentDescription(activity.getString(description));
        view.setTooltipText(activity.getString(description));
        return view;
    }
    private int dp(int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
}
