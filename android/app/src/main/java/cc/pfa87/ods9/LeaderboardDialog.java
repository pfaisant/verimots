package cc.pfa87.ods9;

import android.app.Activity;
import android.app.Dialog;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Locale;

/** One live board for all games, with independent category and period filters. */
final class LeaderboardDialog extends Dialog {
    private static final String[] CATEGORIES = {"checks", "combined", "bingo", "kids", "find", "training"};
    private static final int[] LABELS = {R.string.board_checks, R.string.board_combined,
            R.string.menu_comp, R.string.level_beginner, R.string.menu_find, R.string.menu_training};
    private static final int[] ICONS = {R.drawable.ic_check, R.drawable.ic_tab_game,
            R.drawable.ic_tab_board, R.drawable.ic_book, R.drawable.ic_tab_check, R.drawable.ic_combinations};
    private static final String[] SCOPES = {"day", "week", "all"};
    private static final int[] SCOPE_LABELS = {R.string.board_day, R.string.board_week,
            R.string.board_compact_all_time};
    private final Activity activity;
    private final LinearLayout list;
    private final TextView detail;
    private final TextView scoreHeading;
    private final ScrollView scroll;
    private final LinearLayout footer;
    private final TextView pageLabel;
    private final TextView personal;
    private final ImageButton previous;
    private final ImageButton next;
    private final ImageButton reload;
    private final ArrayList<JSONObject> entries = new ArrayList<>();
    private JSONObject ownEntry;
    private boolean showingCounts;
    private boolean showingCombined;
    private int page;
    private int pageSize = 3;
    private final Spinner categoryPicker;
    private final Spinner scopePicker;
    private int selectedCategory;
    private int selectedScope = 1;
    private int generation;
    private final View.OnLayoutChangeListener boundsChanged = (view, left, top, right, bottom,
            oldLeft, oldTop, oldRight, oldBottom) -> {
        if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) resizeWindow();
    };

    LeaderboardDialog(Activity activity) {
        super(activity);
        this.activity = activity;
        LinearLayout root = column();
        root.setBackgroundResource(R.drawable.bg_card);
        root.setPadding(dp(16), dp(12), dp(16), dp(8));
        LinearLayout head = row();
        LinearLayout heading = column();
        TextView title = text(activity.getString(R.string.leaderboard_title), 20, R.color.ink);
        title.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        title.setMaxLines(2);
        heading.addView(title);
        Locale language = new Locale(Lang.get(activity));
        TextView languageLabel = text(language.getDisplayLanguage(language), 12, R.color.muted);
        languageLabel.setPadding(0, dp(3), 0, dp(4));
        heading.addView(languageLabel);
        head.addView(heading, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
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
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        scroll.setFillViewport(true);
        LinearLayout body = column();
        scroll.addView(body);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        LinearLayout filters = row();
        categoryPicker = picker(LABELS, selectedCategory, R.string.board_category);
        categoryPicker.setId(R.id.board_compact_category);
        categoryPicker.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (selectedCategory == position) return;
                selectedCategory = position; page = 0; refresh();
            }
            @Override public void onNothingSelected(AdapterView<?> parent) { }
        });
        LinearLayout.LayoutParams categoryParams = new LinearLayout.LayoutParams(0, dp(48), 1.2f);
        categoryParams.setMarginEnd(dp(8));
        filters.addView(categoryPicker, categoryParams);
        scopePicker = picker(SCOPE_LABELS, selectedScope, R.string.board_compact_period);
        scopePicker.setId(R.id.board_compact_period);
        scopePicker.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (selectedScope == position) return;
                selectedScope = position; page = 0; refresh();
            }
            @Override public void onNothingSelected(AdapterView<?> parent) { }
        });
        filters.addView(scopePicker, new LinearLayout.LayoutParams(0, dp(48), 1));
        LinearLayout.LayoutParams filterParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        filterParams.topMargin = dp(8);
        body.addView(filters, filterParams);
        detail = text("", 12, R.color.muted);
        detail.setPadding(0, dp(12), 0, dp(8));
        body.addView(detail);
        LinearLayout columns = row();
        columns.setPadding(dp(8), dp(4), dp(8), dp(8));
        TextView rankHeading = text(activity.getString(R.string.board_rank), 10, R.color.dim);
        rankHeading.setGravity(Gravity.CENTER);
        columns.addView(rankHeading, new LinearLayout.LayoutParams(dp(28), ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView playerHeading = text(activity.getString(R.string.board_player), 11, R.color.dim);
        playerHeading.setPadding(dp(6), 0, dp(6), 0);
        columns.addView(playerHeading, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        scoreHeading = text("", 11, R.color.dim);
        scoreHeading.setGravity(Gravity.END);
        columns.addView(scoreHeading, new LinearLayout.LayoutParams(dp(76), ViewGroup.LayoutParams.WRAP_CONTENT));
        body.addView(columns);
        list = column();
        body.addView(list);
        footer = column();
        footer.setPadding(0, dp(6), 0, 0);
        personal = text("", 12, R.color.gold);
        personal.setGravity(Gravity.CENTER);
        personal.setPadding(dp(4), dp(5), dp(4), dp(5));
        footer.addView(personal);
        LinearLayout pages = row();
        previous = action(R.drawable.ic_next, R.string.board_previous_page);
        previous.setRotation(180);
        previous.setOnClickListener(v -> changePage(-1));
        pages.addView(previous, new LinearLayout.LayoutParams(dp(48), dp(48)));
        pageLabel = text("", 12, R.color.muted);
        pageLabel.setGravity(Gravity.CENTER);
        pageLabel.setFontFeatureSettings("tnum");
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
        if (window != null) {
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
            window.setLayout(Math.max(1, Math.min(width - dp(24), dp(520))), Math.max(1, height - dp(24)));
            int heightDp = Math.round(height / activity.getResources().getDisplayMetrics().density);
            int nextSize = Math.max(3, Math.min(10, (heightDp - 270) / 72));
            if (nextSize != pageSize) {
                page = page * pageSize / nextSize;
                pageSize = nextSize;
                if (!entries.isEmpty()) renderEntries();
            }
        }
    }

    void refresh() {
        if (!isShowing() || activity.isFinishing() || activity.isDestroyed()) return;
        entries.clear();
        ownEntry = null;
        final int request = ++generation;
        final String category = CATEGORIES[selectedCategory];
        final boolean combined = "combined".equals(category);
        final boolean activityBoard = !"bingo".equals(category) && !"kids".equals(category);
        detail.setText(combined ? R.string.board_combined_detail
                : activityBoard ? R.string.board_activity_since : R.string.board_score_detail);
        scoreHeading.setText(combined ? R.string.board_column_activities
                : activityBoard ? R.string.board_column_words : R.string.board_column_points);
        categoryPicker.setContentDescription(activity.getString(R.string.board_category) + ": "
                + activity.getString(LABELS[selectedCategory]));
        scopePicker.setContentDescription(activity.getString(R.string.board_compact_period) + ": "
                + activity.getString(SCOPE_LABELS[selectedScope]));
        reload.setEnabled(false);
        reload.setAlpha(0.45f);
        notice(activity.getString(R.string.loading), false, true);
        RemoteApi.fetchCategoryBoard(CATEGORIES[selectedCategory], Lang.get(activity), SCOPES[selectedScope], new RemoteApi.BoardCb() {
            @Override public void ok(JSONArray top, JSONObject me) {
                if (!isShowing() || activity.isFinishing() || activity.isDestroyed() || request != generation) return;
                finishLoading();
                if (top.length() == 0 && me == null) {
                    notice(activity.getString(R.string.board_activity_empty), false, false);
                    return;
                }
                entries.clear();
                ownEntry = me;
                showingCounts = activityBoard;
                showingCombined = combined;
                boolean meShown = false;
                for (int i = 0; i < top.length(); i++) {
                    JSONObject entry = top.optJSONObject(i);
                    if (entry == null) continue;
                    boolean mine = me != null && me.optInt("rank") == entry.optInt("rank");
                    if (mine) meShown = true;
                    entries.add(entry);
                }
                if (me != null && !meShown) entries.add(me);
                renderEntries();
            }
            @Override public void error(String message) {
                if (isShowing() && !activity.isFinishing() && !activity.isDestroyed() && request == generation) {
                    finishLoading();
                    notice(activity.getString(R.string.board_connection_error), true, false);
                }
            }
        });
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
            JSONObject entry = entries.get(i);
            addEntry(entry, ownEntry != null && ownEntry.optInt("rank") == entry.optInt("rank"), showingCounts, showingCombined);
        }
        footer.setVisibility(View.VISIBLE);
        personal.setVisibility(ownEntry == null ? View.GONE : View.VISIBLE);
        if (ownEntry != null) personal.setText(activity.getString(R.string.board_personal_position, ownEntry.optInt("rank"))
                + " · " + valueWithUnit(ownEntry, showingCounts, showingCombined));
        previous.setEnabled(page > 0);
        previous.setAlpha(page > 0 ? 1f : 0.25f);
        next.setEnabled(page + 1 < pages);
        next.setAlpha(page + 1 < pages ? 1f : 0.25f);
        previous.setVisibility(pages > 1 ? View.VISIBLE : View.INVISIBLE);
        next.setVisibility(pages > 1 ? View.VISIBLE : View.INVISIBLE);
        pageLabel.setText(activity.getString(R.string.board_page_number, page + 1, pages));
        pageLabel.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    }

    private void notice(String message, boolean retry, boolean loading) {
        list.removeAllViews();
        footer.setVisibility(View.GONE);
        LinearLayout state = column();
        state.setGravity(Gravity.CENTER);
        state.setPadding(dp(12), dp(24), dp(12), dp(24));
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

    private void addEntry(JSONObject entry, boolean mine, boolean counts, boolean combined) {
        if (list.getChildCount() > 0) {
            View divider = new View(activity);
            divider.setBackgroundColor(activity.getColor(R.color.card_line));
            list.addView(divider, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        }
        LinearLayout card = column();
        card.setPadding(dp(8), dp(10), dp(8), dp(10));
        card.setMinimumHeight(dp(52));
        if (mine) card.setBackgroundResource(R.drawable.board_compact_mine);
        LinearLayout line = row();
        int rank = entry.optInt("rank");
        TextView badge = text(String.valueOf(rank), 13, rank >= 1 && rank <= 3 ? R.color.gold : R.color.dim);
        badge.setGravity(Gravity.CENTER);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setAutoSizeTextTypeUniformWithConfiguration(8, 12, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
        line.addView(badge, new LinearLayout.LayoutParams(dp(28), dp(28)));
        TextView name = text(entry.optString("pseudo", "?"), 14, mine ? R.color.gold : R.color.ink);
        name.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        name.setSingleLine(true);
        name.setEllipsize(TextUtils.TruncateAt.END);
        name.setPadding(dp(6), 0, dp(6), 0);
        line.addView(name, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        Locale locale = new Locale(Lang.get(activity));
        NumberFormat integer = NumberFormat.getIntegerInstance(locale);
        String score = formattedValue(entry, counts);
        String sub = "";
        if (combined) {
            JSONObject breakdown = entry.optJSONObject("breakdown");
            if (breakdown != null) {
                StringBuilder parts = new StringBuilder();
                for (int i = 0; i < CATEGORIES.length; i++) {
                    long value = breakdown.optLong(CATEGORIES[i]);
                    if (value <= 0) continue;
                    if (parts.length() > 0) parts.append(" · ");
                    parts.append(activity.getString(LABELS[i])).append(" : ").append(integer.format(value));
                }
                sub = parts.toString();
            }
        } else if (!counts) {
            sub = String.format(locale, "%.1f%%", entry.optDouble("percent"))
                    + " · " + (entry.optInt("plays") == 1 ? activity.getString(R.string.board_plays_one)
                    : activity.getString(R.string.board_plays_n, entry.optInt("plays")));
        }
        TextView value = text(score, 16, mine ? R.color.gold : R.color.ink);
        value.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        value.setTypeface(Typeface.DEFAULT_BOLD);
        value.setFontFeatureSettings("tnum");
        value.setSingleLine(true);
        value.setHorizontallyScrolling(false);
        value.setAutoSizeTextTypeUniformWithConfiguration(10, 16, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
        line.addView(value, new LinearLayout.LayoutParams(dp(76), dp(28)));
        card.addView(line);
        if (!sub.isEmpty()) {
            TextView extra = text(sub, 11, R.color.muted);
            extra.setPadding(dp(34), dp(3), 0, 0);
            extra.setLineSpacing(dp(3), 1f);
            extra.setMaxLines(2);
            extra.setEllipsize(TextUtils.TruncateAt.END);
            card.addView(extra);
        }
        card.setContentDescription(rank + ". " + entry.optString("pseudo") + ", "
                + valueWithUnit(entry, counts, combined) + (sub.isEmpty() ? "" : ". " + sub));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        list.addView(card, params);
    }

    private Spinner picker(int[] labels, int selected, int description) {
        Spinner picker = new Spinner(activity, Spinner.MODE_DROPDOWN);
        picker.setBackgroundResource(R.drawable.board_compact_picker);
        picker.setPopupBackgroundResource(R.drawable.board_compact_popup);
        picker.setPadding(0, 0, 0, 0);
        picker.setPrompt(activity.getString(description));
        picker.setContentDescription(activity.getString(description));
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
    private String formattedValue(JSONObject entry, boolean counts) {
        return NumberFormat.getIntegerInstance(new Locale(Lang.get(activity))).format(
                counts ? entry.optLong("count") : Math.round(entry.optDouble("points")));
    }
    private String valueWithUnit(JSONObject entry, boolean counts, boolean combined) {
        String value = formattedValue(entry, counts);
        if (!counts) return value + " " + activity.getString(R.string.pts_unit);
        int quantity = entry.optLong("count") == 1 ? 1 : 2;
        return activity.getResources().getQuantityString(combined ? R.plurals.board_activities_count
                : R.plurals.board_words_count, quantity, value);
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
