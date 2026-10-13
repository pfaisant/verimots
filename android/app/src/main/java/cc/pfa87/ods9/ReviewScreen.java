package cc.pfa87.ods9;

import android.app.Activity;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Révisions screen (web review.js): the saved draws with their schedule, and
 * the replay of a draw with the missed words as the goal — slots, rack,
 * hints (first letter, then the definition with the word masked), the answer.
 * Words and racks are stored in display form; the lexicon's encoding is only
 * used to compare and to draw tiles.
 */
final class ReviewScreen {
    interface Host {
        Lexicon lexicon();

        void leave();

        void hideKeyboard();
    }

    private final Activity act;
    private final Host host;
    private final View view;
    private final ScrollView scroll;
    private final View home;
    private final View play;
    private final TextView syncLine;
    private final TextView dueN;
    private final TextView laterN;
    private final TextView masteredN;
    private final TextView banner;
    private final TextView quiet;
    private final TextView start;
    private final TextView howToggle;
    private final TextView how;
    private final LinearLayout list;
    private final TextView others;
    private final LinearLayout stage;
    private final TextView kicker;
    private final TextView goal;
    private final FlowLayout slots;
    private final LinearLayout rack;
    private final View form;
    private final EditText input;
    private final View clear;
    private final TextView live;
    private final View tools;
    private final TextView hintBtn;
    private final TextView showBtn;
    private final TextView hintBox;
    private final View result;
    private final TextView status;
    private final TextView played;
    private final FlowLayout answers;
    private final View defBox;
    private final TextView defHead;
    private final TextView defBody;
    private final TextView next;
    private final TextView menuSub;
    private final TextView menuBadge;

    private List<String> session;
    private int index;
    private int okCount;
    private int doneCount;
    private ReviewRules.Item cur;
    private String encRack = "";
    private List<Lexicon.Play> catalog = new ArrayList<>();
    private final Set<String> found = new HashSet<>();
    private final Map<String, Integer> levels = new HashMap<>();
    private boolean hinted;
    private boolean shown;
    private boolean done;
    private boolean early;
    private int seq;
    private ReviewRules.Item undo;
    /** Line above the list (end of a session); stays until the next action. */
    private String bannerText;
    private boolean bannerGood;

    ReviewScreen(Activity act, Host host) {
        this.act = act;
        this.host = host;
        view = act.findViewById(R.id.game_review);
        scroll = act.findViewById(R.id.review_scroll);
        home = act.findViewById(R.id.review_home);
        play = act.findViewById(R.id.review_play);
        syncLine = act.findViewById(R.id.review_sync);
        dueN = act.findViewById(R.id.review_due_n);
        laterN = act.findViewById(R.id.review_later_n);
        masteredN = act.findViewById(R.id.review_mastered_n);
        banner = act.findViewById(R.id.review_banner);
        quiet = act.findViewById(R.id.review_quiet);
        start = act.findViewById(R.id.review_start);
        howToggle = act.findViewById(R.id.review_how_toggle);
        how = act.findViewById(R.id.review_how);
        list = act.findViewById(R.id.review_list);
        others = act.findViewById(R.id.review_others);
        stage = act.findViewById(R.id.review_stage);
        kicker = act.findViewById(R.id.review_kicker);
        goal = act.findViewById(R.id.review_goal);
        slots = act.findViewById(R.id.review_slots);
        rack = act.findViewById(R.id.review_rack);
        form = act.findViewById(R.id.review_form);
        input = act.findViewById(R.id.review_q);
        clear = act.findViewById(R.id.review_clear);
        live = act.findViewById(R.id.review_live);
        tools = act.findViewById(R.id.review_tools);
        hintBtn = act.findViewById(R.id.review_hint);
        showBtn = act.findViewById(R.id.review_show);
        hintBox = act.findViewById(R.id.review_hint_box);
        result = act.findViewById(R.id.review_result);
        status = act.findViewById(R.id.review_status);
        played = act.findViewById(R.id.review_played);
        answers = act.findViewById(R.id.review_answers);
        defBox = act.findViewById(R.id.review_def);
        defHead = act.findViewById(R.id.review_def_head);
        defBody = act.findViewById(R.id.review_def_body);
        next = act.findViewById(R.id.review_next);
        menuSub = act.findViewById(R.id.menu_review_sub);
        menuBadge = act.findViewById(R.id.menu_review_badge);

        start.setOnClickListener(v -> {
            ArrayList<String> ids = new ArrayList<>();
            for (ReviewRules.Item i : ReviewRules.due(scoped(), cutoff())) ids.add(i.id);
            startSession(ids);
        });
        howToggle.setOnClickListener(v -> how.setVisibility(how.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        banner.setOnClickListener(v -> {
            if (undo == null) return;
            ReviewStore.restore(act, undo);
            undo = null;
            bannerText = null;
            paintHome();
            paintMenu();
            ReviewStore.sync(act, this::refreshAfterSync);
        });
        act.findViewById(R.id.review_go).setOnClickListener(v -> submit());
        input.setOnEditorActionListener((v, actionId, event) -> {
            boolean enter = event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN;
            if (actionId == EditorInfo.IME_ACTION_DONE || enter) {
                submit();
                return true;
            }
            return false;
        });
        input.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) {
                paintRack();
                if (clear != null) clear.setVisibility(s.length() > 0 && !done ? View.VISIBLE : View.GONE);
            }
        });
        if (clear != null) clear.setOnClickListener(v -> input.setText(""));
        hintBtn.setOnClickListener(v -> hint());
        showBtn.setOnClickListener(v -> {
            if (cur == null || done) return;
            shown = true;
            finish("miss");
        });
        next.setOnClickListener(v -> advance());
    }

    boolean visible() {
        return view != null && view.getVisibility() == View.VISIBLE;
    }

    /** Back from the replay returns to the list; from the list, the caller leaves. */
    boolean back() {
        if (play.getVisibility() == View.VISIBLE) {
            session = null;
            open(null, false);
            return true;
        }
        return false;
    }

    // ---- scope and time ---------------------------------------------------------

    private static long cutoff() {
        return ReviewStore.endOfDay(System.currentTimeMillis());
    }

    private boolean inScope(ReviewRules.Item i) {
        return i.dict.equals(Dict.get(act)) && (!"es".equals(i.lang) || i.edition.equals(Dict.esEdition(act)));
    }

    private List<ReviewRules.Item> scoped() {
        ArrayList<ReviewRules.Item> out = new ArrayList<>();
        for (ReviewRules.Item i : ReviewRules.live(ReviewStore.load(act).items)) if (inScope(i)) out.add(i);
        return out;
    }

    private String when(long due) {
        long now = System.currentTimeMillis();
        if (due <= ReviewStore.endOfDay(now)) return act.getString(R.string.rev_when_now);
        int days = ReviewStore.daysUntil(due, now);
        return days <= 1 ? act.getString(R.string.rev_when_tomorrow) : act.getString(R.string.rev_when_days, days);
    }

    // ---- menu card -------------------------------------------------------------

    void paintMenu() {
        if (menuSub == null) return;
        ReviewRules.Counts c = ReviewRules.counts(scoped(), cutoff());
        if (c.due > 0) menuSub.setText(c.due == 1 ? act.getString(R.string.rev_menu_due_one) : act.getString(R.string.rev_menu_due, c.due));
        else if (c.next > 0) menuSub.setText(act.getString(R.string.rev_menu_next, when(c.next)));
        else if (c.mastered > 0) menuSub.setText(R.string.rev_menu_clear);
        else menuSub.setText(R.string.rev_menu_empty);
        if (menuBadge != null) {
            menuBadge.setVisibility(c.due > 0 ? View.VISIBLE : View.GONE);
            menuBadge.setText(String.valueOf(c.due));
        }
    }

    // ---- recording -------------------------------------------------------------

    /** From the games; returns true when the draw was saved. */
    boolean record(String game, String encodedRack, List<Lexicon.Play> targets, Lexicon.Play playedWord,
                   String preset, int min, int max, int bonus) {
        if (targets == null || targets.isEmpty() || encodedRack == null || encodedRack.isEmpty()) return false;
        ReviewRules.Item miss = new ReviewRules.Item();
        miss.game = game;
        miss.lang = Lang.get(act);
        miss.dict = Dict.get(act);
        miss.edition = Lang.ES.equals(miss.lang) ? Dict.esEdition(act) : Dict.ES_FISE;
        miss.rack = Lexicon.displayRackOf(encodedRack);
        for (Lexicon.Play p : targets) {
            if (miss.targets.size() >= ReviewRules.MAX_TARGETS) break;
            miss.targets.add(new ReviewRules.Word(Lexicon.display(p.word), p.pts()));
        }
        if (playedWord != null) miss.played = new ReviewRules.Word(Lexicon.display(playedWord.word), playedWord.pts());
        if ("combi".equals(game)) {
            miss.preset = preset == null ? "all" : preset;
            miss.min = min;
            miss.max = max;
            miss.bonus = bonus;
        }
        boolean saved = ReviewStore.record(act, miss) != null;
        if (saved) {
            paintMenu();
            ReviewStore.sync(act, this::refreshAfterSync);
        }
        return saved;
    }

    /** Coming back to the app: pull the account's list, at most once a minute. */
    void syncIfStale() {
        if (System.currentTimeMillis() - ReviewStore.lastAttempt < 60_000) return;
        ReviewStore.sync(act, this::refreshAfterSync);
    }

    private void refreshAfterSync() {
        paintMenu();
        if (visible() && home.getVisibility() == View.VISIBLE) paintHome();
        else paintSyncLine();
    }

    // ---- list ------------------------------------------------------------------

    void open(String banner, boolean good) {
        seq++;
        cur = null;
        undo = null;
        bannerText = banner;
        bannerGood = good;
        host.hideKeyboard();
        home.setVisibility(View.VISIBLE);
        play.setVisibility(View.GONE);
        paintHome();
        if (scroll != null) scroll.post(() -> scroll.scrollTo(0, 0));
        ReviewStore.sync(act, this::refreshAfterSync);
    }

    private void paintSyncLine() {
        if (syncLine == null) return;
        syncLine.setText(!Session.loggedIn(act) ? R.string.rev_local
                : ReviewStore.lastFailed ? R.string.rev_sync_failed
                : ReviewStore.lastSync > 0 ? R.string.rev_synced : R.string.rev_syncing);
    }

    private void paintHome() {
        long cut = cutoff();
        List<ReviewRules.Item> all = ReviewRules.live(ReviewStore.load(act).items);
        List<ReviewRules.Item> items = new ArrayList<>();
        for (ReviewRules.Item i : all) if (inScope(i)) items.add(i);
        ReviewRules.Counts c = ReviewRules.counts(items, cut);
        dueN.setText(String.valueOf(c.due));
        laterN.setText(String.valueOf(c.later));
        masteredN.setText(String.valueOf(c.mastered));
        if (undo != null) {
            banner.setVisibility(View.VISIBLE);
            banner.setTextColor(act.getColor(R.color.gold));
            banner.setText(act.getString(R.string.rev_deleted) + "  " + act.getString(R.string.rev_undo));
        } else if (bannerText != null) {
            banner.setVisibility(View.VISIBLE);
            banner.setText(bannerText);
            banner.setTextColor(act.getColor(bannerGood ? R.color.ok : R.color.gold));
        } else {
            banner.setVisibility(View.GONE);
        }
        start.setVisibility(c.due > 0 ? View.VISIBLE : View.GONE);
        start.setText(c.due == 1 ? act.getString(R.string.rev_start_one) : act.getString(R.string.rev_start, c.due));
        if (items.isEmpty()) {
            quiet.setVisibility(View.VISIBLE);
            quiet.setText(R.string.rev_empty);
            how.setVisibility(View.VISIBLE);
        } else if (c.due == 0) {
            quiet.setVisibility(View.VISIBLE);
            quiet.setText(c.next > 0 ? act.getString(R.string.rev_none_due_next, when(c.next)) : act.getString(R.string.rev_none_due));
        } else {
            quiet.setVisibility(View.GONE);
        }
        list.removeAllViews();
        List<ReviewRules.Item> due = ReviewRules.due(items, cut);
        ArrayList<ReviewRules.Item> later = new ArrayList<>();
        ArrayList<ReviewRules.Item> mastered = new ArrayList<>();
        for (ReviewRules.Item i : items) {
            if (i.mastered) mastered.add(i);
            else if (i.due > cut) later.add(i);
        }
        Collections.sort(later, (a, b) -> Long.compare(a.due, b.due));
        Collections.sort(mastered, (a, b) -> Long.compare(b.updatedAt, a.updatedAt));
        group(R.string.rev_stat_due, due);
        group(R.string.rev_stat_later, later);
        group(R.string.rev_stat_mastered, mastered);
        int otherCount = all.size() - items.size();
        others.setVisibility(otherCount > 0 ? View.VISIBLE : View.GONE);
        others.setText(otherCount == 1 ? act.getString(R.string.rev_other_dicts_one) : act.getString(R.string.rev_other_dicts, otherCount));
        paintSyncLine();
    }

    private int dp(float v) {
        return Math.round(v * act.getResources().getDisplayMetrics().density);
    }

    private void group(int title, List<ReviewRules.Item> rows) {
        if (rows.isEmpty()) return;
        TextView head = new TextView(act);
        head.setText(act.getString(title).toUpperCase(java.util.Locale.ROOT) + "  " + rows.size());
        head.setTextColor(act.getColor(R.color.gold));
        head.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        head.setLetterSpacing(0.14f);
        head.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.BOLD));
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hp.topMargin = dp(14);
        hp.bottomMargin = dp(6);
        list.addView(head, hp);
        for (ReviewRules.Item i : rows) list.addView(row(i));
    }

    private String gameLabel(String game) {
        return act.getString("bingo".equals(game) ? R.string.rev_game_bingo
                : "combi".equals(game) ? R.string.rev_game_combi : R.string.rev_game_find);
    }

    private String targetsLabel(ReviewRules.Item i) {
        if (i.combi()) {
            int n = i.targets.size();
            return n == 1 ? act.getString(R.string.rev_targets_combi_one) : act.getString(R.string.rev_targets_combi, n);
        }
        ReviewRules.Word best = i.targets.get(0);
        return act.getString(R.string.rev_targets_best, Lexicon.normalize(best.w).length(), best.p);
    }

    private View row(ReviewRules.Item item) {
        LinearLayout card = new LinearLayout(act);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundResource(R.drawable.bg_card);
        card.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cp.bottomMargin = dp(8);
        card.setLayoutParams(cp);
        if (item.mastered) card.setAlpha(0.85f);

        LinearLayout top = new LinearLayout(act);
        top.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout mini = new LinearLayout(act);
        String enc = Lexicon.normalizeRack(item.rack);
        for (int k = 0; k < enc.length(); k++) mini.addView(miniTile(enc.charAt(k), k > 0));
        top.addView(mini, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        android.widget.ImageButton del = new android.widget.ImageButton(act);
        del.setImageResource(R.drawable.ic_clear);
        del.setBackgroundResource(R.drawable.bg_icon_action);
        del.setPadding(dp(13), dp(13), dp(13), dp(13));
        del.setContentDescription(act.getString(R.string.rev_delete_aria));
        del.setOnClickListener(v -> delete(item));
        top.addView(del, new LinearLayout.LayoutParams(dp(44), dp(44)));
        card.addView(top);

        LinearLayout foot = new LinearLayout(act);
        foot.setGravity(Gravity.BOTTOM);
        LinearLayout.LayoutParams fp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        fp.topMargin = dp(8);
        LinearLayout meta = new LinearLayout(act);
        meta.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(act);
        String label = gameLabel(item.game) + " · " + targetsLabel(item);
        android.text.SpannableString styled = new android.text.SpannableString(label);
        styled.setSpan(new android.text.style.StyleSpan(android.graphics.Typeface.BOLD), 0, gameLabel(item.game).length(), 0);
        styled.setSpan(new android.text.style.ForegroundColorSpan(act.getColor(R.color.muted)),
                gameLabel(item.game).length(), label.length(), 0);
        title.setText(styled);
        title.setTextColor(act.getColor(R.color.ink));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        meta.addView(title);
        TextView whenLine = new TextView(act);
        String missed = DateFormat.getDateInstance(DateFormat.MEDIUM).format(new Date(item.missedAt));
        whenLine.setText(dots(item) + "  " + act.getString(R.string.rev_missed_on, missed) + " · "
                + (item.mastered ? act.getString(R.string.rev_mastered_short) : when(item.due)));
        whenLine.setTextColor(act.getColor(R.color.dim));
        whenLine.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
        whenLine.setPadding(0, dp(3), 0, 0);
        meta.addView(whenLine);
        foot.addView(meta, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView again = new TextView(act);
        again.setText(R.string.rev_play);
        again.setTextColor(act.getColor(R.color.gold));
        again.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        again.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.BOLD));
        again.setGravity(Gravity.CENTER);
        again.setBackgroundResource(R.drawable.bg_pill);
        again.setPadding(dp(16), 0, dp(16), 0);
        again.setMinHeight(dp(44));
        again.setOnClickListener(v -> {
            ArrayList<String> one = new ArrayList<>();
            one.add(item.id);
            startSession(one);
        });
        LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(44));
        ap.setMarginStart(dp(10));
        foot.addView(again, ap);
        card.addView(foot, fp);
        return card;
    }

    private String dots(ReviewRules.Item item) {
        int total = ReviewRules.STEPS.length + 1;
        int done = item.mastered ? total : item.step;
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < total; i++) b.append(i < done ? '●' : '○');
        return b.toString();
    }

    private View miniTile(char code, boolean gap) {
        TextView t = new TextView(act);
        boolean blank = code == '?';
        t.setText(blank ? "?" : Lexicon.tileGlyph(code));
        t.setGravity(Gravity.CENTER);
        t.setTextColor(act.getColor(R.color.tile_ink));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, Lexicon.tileGlyph(code).length() > 1 ? 10 : 14);
        t.setTypeface(act.getResources().getFont(R.font.verimots_tiles));
        t.setIncludeFontPadding(false);
        t.setBackgroundResource(R.drawable.bg_tile);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(26), dp(29));
        if (gap) lp.setMarginStart(dp(3));
        t.setLayoutParams(lp);
        return t;
    }

    private void delete(ReviewRules.Item item) {
        ReviewStore.delete(act, item.id);
        undo = item;
        bannerText = null;
        paintHome();
        paintMenu();
        ReviewStore.sync(act, this::refreshAfterSync);
    }

    // ---- replay ----------------------------------------------------------------

    private void startSession(List<String> ids) {
        if (ids.isEmpty()) return;
        session = ids;
        index = 0;
        okCount = 0;
        doneCount = 0;
        home.setVisibility(View.GONE);
        play.setVisibility(View.VISIBLE);
        playCurrent();
    }

    private void playCurrent() {
        seq++;
        String id = session.get(index);
        ReviewRules.Item item = null;
        for (ReviewRules.Item i : ReviewStore.load(act).items) if (i.id.equals(id) && !i.deleted) item = i;
        if (item == null) {
            advance();
            return;
        }
        cur = item;
        encRack = Lexicon.normalizeRack(item.rack);
        found.clear();
        levels.clear();
        hinted = false;
        shown = false;
        done = false;
        early = !item.mastered && item.due > cutoff();
        String label = gameLabel(item.game);
        kicker.setText(session.size() > 1 ? label + " · " + act.getString(R.string.rev_progress, index + 1, session.size()) : label);
        int n = item.targets.size();
        goal.setText(item.combi()
                ? (n == 1 ? act.getString(R.string.rev_goal_combi_one) : act.getString(R.string.rev_goal_combi, n))
                : (n > 1 ? act.getString(R.string.rev_goal_best_any, n) : act.getString(R.string.rev_goal_best)));
        // One to three words read as a goal above the rack; a long Combinaisons
        // list goes under the tools so the rack and the input stay in view.
        stage.removeView(slots);
        int at = stage.indexOfChild(n > 3 ? hintBox : rack);
        stage.addView(slots, n > 3 ? at + 1 : at);
        Lexicon lex = host.lexicon();
        int min = item.combi() ? item.min : 2;
        int max = item.combi() ? item.max : 15;
        catalog = lex == null ? new ArrayList<>() : lex.anagrams(encRack, min, max);
        result.setVisibility(View.GONE);
        next.setVisibility(View.GONE);
        hintBox.setVisibility(View.GONE);
        tools.setVisibility(View.VISIBLE);
        form.setVisibility(View.VISIBLE);
        input.setEnabled(true);
        input.setText("");
        setLive("", 0);
        paintSlots();
        paintRack();
        paintTools();
        if (scroll != null) scroll.post(() -> scroll.scrollTo(0, 0));
    }

    private static int[] assign(String rackCodes, String word) {
        int[] at = new int[word.length()];
        java.util.Arrays.fill(at, -1);
        boolean[] used = new boolean[rackCodes.length()];
        for (int k = 0; k < word.length(); k++) {
            for (int i = 0; i < rackCodes.length(); i++) {
                if (!used[i] && rackCodes.charAt(i) == word.charAt(k)) {
                    used[i] = true;
                    at[k] = i;
                    break;
                }
            }
        }
        for (int k = 0; k < word.length(); k++) {
            if (at[k] >= 0) continue;
            for (int i = 0; i < rackCodes.length(); i++) {
                if (!used[i] && rackCodes.charAt(i) == '?') {
                    used[i] = true;
                    at[k] = i;
                    break;
                }
            }
        }
        return at;
    }

    private void paintRack() {
        if (cur == null) return;
        String word = Lexicon.normalize(input.getText().toString());
        int[] at = assign(encRack, word);
        HashSet<Integer> used = new HashSet<>();
        for (int i : at) if (i >= 0) used.add(i);
        Tiles.fill(rack, encRack, done ? null : used, done ? null : v -> {
            int i = (Integer) v.getTag();
            String typed = Lexicon.normalize(input.getText().toString());
            int[] map = assign(encRack, typed);
            int pos = -1;
            for (int k = 0; k < map.length; k++) if (map[k] == i) pos = k;
            if (pos >= 0) {
                typed = typed.substring(0, pos) + typed.substring(pos + 1);
            } else if (encRack.charAt(i) == '?') {
                Toast.makeText(act, R.string.joker_type_letter, Toast.LENGTH_SHORT).show();
                input.requestFocus();
                return;
            } else {
                typed = typed + encRack.charAt(i);
            }
            String shownText = Lexicon.display(typed);
            input.setText(shownText);
            input.setSelection(shownText.length());
        }, cur.combi() ? cur.bonus : -1, false);
    }

    private void paintSlots() {
        slots.removeAllViews();
        boolean many = cur.targets.size() > 3;
        for (ReviewRules.Word t : cur.targets) {
            LinearLayout slot = new LinearLayout(act);
            slot.setGravity(Gravity.CENTER_VERTICAL);
            String enc = Lexicon.normalize(t.w);
            boolean isFound = found.contains(t.w);
            boolean open = isFound || shown;
            boolean first = levels.containsKey(t.w);
            for (int k = 0; k < enc.length(); k++) {
                TextView cell = new TextView(act);
                cell.setGravity(Gravity.CENTER);
                cell.setTypeface(act.getResources().getFont(R.font.verimots_tiles));
                cell.setIncludeFontPadding(false);
                String glyph = Lexicon.tileGlyph(enc.charAt(k));
                cell.setTextSize(TypedValue.COMPLEX_UNIT_SP, many ? (glyph.length() > 1 ? 8 : 11) : (glyph.length() > 1 ? 10 : 14));
                if (open || (first && k == 0)) cell.setText(glyph);
                if (isFound) {
                    cell.setBackgroundResource(R.drawable.bg_tile);
                    cell.setTextColor(act.getColor(R.color.tile_ink));
                } else if (shown) {
                    cell.setBackgroundResource(R.drawable.bg_status_no);
                    cell.setTextColor(act.getColor(R.color.no));
                } else if (first && k == 0) {
                    cell.setBackgroundResource(R.drawable.bg_pill_hint);
                    cell.setTextColor(0xFFFFC774);
                } else {
                    cell.setBackgroundResource(R.drawable.bg_review_cell);
                }
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(many ? 17 : 22), dp(many ? 21 : 26));
                if (k > 0) lp.setMarginStart(dp(many ? 2 : 3));
                slot.addView(cell, lp);
            }
            TextView pts = new TextView(act);
            pts.setText(String.valueOf(t.p));
            pts.setTextColor(act.getColor(R.color.dim));
            pts.setTextSize(TypedValue.COMPLEX_UNIT_SP, many ? 11 : 12);
            pts.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.BOLD));
            LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            pp.setMarginStart(dp(5));
            pp.setMarginEnd(dp(many ? 8 : 10));
            slot.addView(pts, pp);
            slots.addView(slot);
        }
    }

    private List<ReviewRules.Word> remaining() {
        ArrayList<ReviewRules.Word> out = new ArrayList<>();
        if (cur != null) for (ReviewRules.Word t : cur.targets) if (!found.contains(t.w)) out.add(t);
        return out;
    }

    private void paintTools() {
        boolean more = false;
        for (ReviewRules.Word t : remaining()) {
            Integer l = levels.get(t.w);
            if (l == null || l < 2) more = true;
        }
        hintBtn.setEnabled(!done && more);
        hintBtn.setAlpha(!done && more ? 1f : 0.4f);
        showBtn.setEnabled(!done);
    }

    private void setLive(String text, int color) {
        live.setText(text);
        live.setVisibility(text == null || text.isEmpty() ? View.GONE : View.VISIBLE);
        if (color != 0) live.setTextColor(act.getColor(color));
    }

    private boolean solved() {
        return cur.combi() ? remaining().isEmpty() : !found.isEmpty();
    }

    private void submit() {
        if (cur == null || done) return;
        String word = Lexicon.normalize(input.getText().toString());
        if (word.isEmpty()) return;
        for (ReviewRules.Word t : cur.targets) {
            if (!Lexicon.normalize(t.w).equals(word)) continue;
            input.setText("");
            if (found.contains(t.w)) {
                setLive(act.getString(R.string.rev_already, t.w), R.color.gold);
            } else {
                found.add(t.w);
                setLive(act.getString(R.string.rev_found, t.w), R.color.ok);
            }
            paintSlots();
            paintTools();
            if (solved()) finish(hinted ? "help" : "ok");
            return;
        }
        Lexicon lex = host.lexicon();
        if (lex == null) return;
        Lexicon.Play hit = lex.findPlay(catalog, word);
        if (hit == null) hit = lex.probe(word, encRack);
        if (hit != null) {
            setLive(act.getString(R.string.rev_not_target, Lexicon.display(hit.word), hit.pts()), R.color.gold);
            return;
        }
        if (word.length() < 2) setLive(act.getString(R.string.need_best), R.color.no);
        else if (!lex.has(word)) setLive(act.getString(R.string.not_in_dict, Dict.label(act)), R.color.no);
        else setLive(act.getString(R.string.not_on_rack), R.color.no);
    }

    private void hint() {
        if (cur == null || done) return;
        ReviewRules.Word target = null;
        for (ReviewRules.Word t : remaining()) {
            Integer l = levels.get(t.w);
            if (l == null || l < 2) { target = t; break; }
        }
        if (target == null) return;
        int level = (levels.containsKey(target.w) ? levels.get(target.w) : 0) + 1;
        levels.put(target.w, level);
        hinted = true;
        paintSlots();
        paintTools();
        String enc = Lexicon.normalize(target.w);
        if (level == 1) {
            setLive(act.getString(R.string.rev_hint_first, Lexicon.tileGlyph(enc.charAt(0))), R.color.ok);
            return;
        }
        final int mySeq = seq;
        final ReviewRules.Word word = target;
        final String head = act.getString(R.string.training_hint_title) + " · " + act.getString(R.string.rev_hint_len, enc.length());
        hintBox.setVisibility(View.VISIBLE);
        hintBox.setText(head + "\n" + act.getString(R.string.def_pending));
        RemoteApi.define(word.w, new RemoteApi.DefCb() {
            @Override
            public void ok(String pos, String text, String url, String lemma) {
                if (mySeq != seq || done) return;
                String first = firstDefinition(text);
                // Never leak the word through its own definition.
                String masked = first.replaceAll("(?i)" + Pattern.quote(word.w), "…");
                hintBox.setText(head + "\n" + (masked.isEmpty() ? act.getString(R.string.training_hint_none) : masked));
            }

            @Override
            public void empty(String message) {
                if (mySeq != seq || done) return;
                hintBox.setText(head + "\n" + act.getString(R.string.training_hint_none));
            }
        }, Lang.get(act));
    }

    private static String firstDefinition(String text) {
        if (text == null) return "";
        for (String line : text.split("\n")) {
            String s = line.replaceFirst("^\\s*\\d+[.)]\\s*", "").trim();
            if (s.matches(".*\\p{L}.*") && !s.endsWith(":")) return s;
        }
        return "";
    }

    private void finish(String outcome) {
        done = true;
        host.hideKeyboard();
        long now = System.currentTimeMillis();
        ReviewRules.Item before = cur;
        ReviewRules.Item graded = ReviewStore.grade(act, cur.id, outcome);
        ReviewStore.sync(act, this::refreshAfterSync);
        paintMenu();
        doneCount++;
        if ("ok".equals(outcome)) okCount++;
        input.setEnabled(false);
        form.setVisibility(View.GONE);
        tools.setVisibility(View.GONE);
        hintBox.setVisibility(View.GONE);
        setLive("", 0);
        paintSlots();
        paintRack();
        String head;
        String plan;
        if ("miss".equals(outcome)) {
            head = act.getString(R.string.rev_done_miss);
            plan = act.getString(R.string.rev_plan_tomorrow);
        } else if (early) {
            head = act.getString("ok".equals(outcome) ? R.string.rev_done_ok : R.string.rev_done_help);
            plan = act.getString(R.string.rev_plan_early, when(before.due));
        } else if (graded != null && graded.mastered) {
            head = act.getString(R.string.rev_done_ok);
            plan = act.getString(R.string.rev_plan_mastered);
        } else if ("help".equals(outcome)) {
            head = act.getString(R.string.rev_done_help);
            plan = act.getString(R.string.rev_plan_tomorrow);
        } else {
            head = act.getString(R.string.rev_done_ok);
            plan = act.getString(R.string.rev_plan_next, graded == null ? "" : when(graded.due));
        }
        android.text.SpannableString line = new android.text.SpannableString(head + " " + plan);
        line.setSpan(new android.text.style.StyleSpan(android.graphics.Typeface.BOLD), 0, head.length(), 0);
        line.setSpan(new android.text.style.ForegroundColorSpan(act.getColor("ok".equals(outcome) ? R.color.ok : R.color.ink)),
                0, head.length(), 0);
        status.setText(line);
        if (cur.played != null) {
            played.setVisibility(View.VISIBLE);
            played.setText(act.getString(R.string.rev_played_was, cur.played.w, cur.played.p));
        } else {
            played.setVisibility(View.GONE);
        }
        answers.removeAllViews();
        for (ReviewRules.Word t : cur.targets) {
            boolean got = found.contains(t.w);
            TextView chip = Tiles.resultChip(act, Lexicon.normalize(t.w), t.p, null,
                    act.getColor(got ? R.color.ok : R.color.no));
            chip.setOnClickListener(v -> showDef(t.w));
            answers.addView(chip);
        }
        result.setVisibility(View.VISIBLE);
        next.setVisibility(View.VISIBLE);
        next.setText(index >= session.size() - 1 ? R.string.rev_finish : R.string.rev_next);
        showDef(cur.targets.get(0).w);
    }

    private void showDef(String word) {
        final int mySeq = seq;
        defBox.setVisibility(View.VISIBLE);
        defHead.setText(word);
        defBody.setText(R.string.def_pending);
        RemoteApi.define(word, new RemoteApi.DefCb() {
            @Override
            public void ok(String pos, String text, String url, String lemma) {
                if (mySeq != seq) return;
                defHead.setText(pos == null || pos.isEmpty() ? word : word + " · " + pos);
                defBody.setText(text);
            }

            @Override
            public void empty(String message) {
                if (mySeq != seq) return;
                defBody.setText(R.string.training_hint_none);
            }
        }, Lang.get(act));
    }

    private void advance() {
        if (session == null) {
            open(null, false);
            return;
        }
        if (index < session.size() - 1) {
            index++;
            playCurrent();
            return;
        }
        int total = doneCount;
        int ok = okCount;
        boolean many = session.size() > 1;
        session = null;
        open(many ? act.getString(R.string.rev_session_done, ok, total) : null, ok == total);
    }
}
