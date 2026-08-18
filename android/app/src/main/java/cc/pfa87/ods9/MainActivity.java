package cc.pfa87.ods9;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextPaint;
import android.text.TextWatcher;
import android.text.method.LinkMovementMethod;
import android.text.style.ClickableSpan;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.CompoundButton;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends Activity {
    private Lexicon lex;
    private View paneCheck;
    private View paneGame;
    private View paneAbout;
    private TextView tabCheck;
    private TextView tabGame;
    private TextView tabAbout;
    private TextView live;
    private TextView brandSub;
    private int tab;
    
    private CompetitiveMode competitiveMode;
    private boolean isCompetitiveMode = false;

    private EditText checkQ;
    private View checkCard;
    private TextView checkStatus;
    private TextView checkWord;
    private LinearLayout checkTiles;
    private TextView checkMeta;
    private TextView checkPos;
    private TextView checkDef;
    private TextView checkLemma;
    private TextView checkWiki;
    private TextView checkShare;
    private TextView checkHint;
    private View checkModesScroll;
    private LinearLayout checkModes;
    private LinearLayout checkMatches;
    private TextView checkJoker;
    private View checkRackScroll;
    private LinearLayout checkRackRow;
    private TextView checkRackCap;
    private View checkLensScroll;
    private LinearLayout checkLens;
    private View checkRackHelp;
    private int rackLen;
    private Switch advancedToggle;
    private TextView authStats;
    private LinearLayout authHistory;
    private boolean advanced;
    private String findMode = "exact";
    private String lastShare;
    private View checkClear;
    private final Handler checkHandler = new Handler(Looper.getMainLooper());
    private int checkSeq;
    private TextView authStatus;
    private TextView authGoogle;
    private TextView authLogout;
    private TextView gameMode;
    private LinearLayout gameBoard;
    private TextView gameBoardTitle;

    private LinearLayout gameRack;
    private LinearLayout gameForm;
    private EditText gameQ;
    private TextView gameLive;
    private TextView gameCat;
    private TextView gameAvg;
    private ScrollView gameResult;
    private TextView gamePct;
    private TextView gameBreak;
    private TextView gameVs;
    private FlowLayout gameTop;
    private TextView gamePos;
    private TextView gameDef;
    private TextView gameLemma;
    private ImageButton gameWa;
    private ScoreChartView gameChart;
    private TextView gameLast;
    private TextView gameLastUnit;
    private View gameSpacer;
    private Lexicon.Deal deal;
    private boolean closed;
    private String waText;

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Lang.wrap(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#142018"));
        getWindow().setNavigationBarColor(Color.parseColor("#142018"));
        setContentView(R.layout.activity_main);
        applySystemInsets();

        paneCheck = findViewById(R.id.pane_check);
        paneGame = findViewById(R.id.pane_game);
        paneAbout = findViewById(R.id.pane_about);
        tabCheck = findViewById(R.id.tab_check);
        tabGame = findViewById(R.id.tab_game);
        tabAbout = findViewById(R.id.tab_about);
        live = findViewById(R.id.live);
        brandSub = findViewById(R.id.brand_sub);
        tabCheck.setOnClickListener(v -> showTab(0));
        tabGame.setOnClickListener(v -> showTab(1));
        tabAbout.setOnClickListener(v -> showTab(2));
        
        competitiveMode = new CompetitiveMode(this);
        advanced = getSharedPreferences("verimots-prefs", MODE_PRIVATE).getBoolean("advanced", false);
        paintBuildStamp();
        bindLang();
        bindCheck();
        bindGame();
        bindAuth();
        bindAdvanced();
        paintAuth();
        paintHistory();
        if (competitiveMode.loggedIn()) syncHistory();
        paintChart();
        setEnabled(false);
        new Thread(() -> {
            try {
                lex = Lexicon.get(this, Lang.get(this));
                runOnUiThread(() -> {
                    live.setText(getString(R.string.word_count, String.format(java.util.Locale.FRANCE, "%,d", lex.size()).replace('\u00a0', ' ')));
                    setEnabled(true);
                    applyIntent(getIntent());
                });
            } catch (Exception e) {
                runOnUiThread(() -> live.setText(R.string.lex_unavailable));
            }
        }).start();
        showTab(0);
        RemoteApi.fetchAverage((has, avg) -> gameAvg.setText(fmtAvg(has, avg)));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyIntent(intent);
    }

    private void applyIntent(Intent intent) {
        if (intent == null || intent.getData() == null || lex == null) return;
        Uri u = intent.getData();
        String vue = u.getQueryParameter("vue");
        String w = Lexicon.normalize(u.getQueryParameter("w"));
        String d = Lexicon.normalize(u.getQueryParameter("d"));
        if ("jeu".equals(vue) || (d != null && d.length() >= 2)) {
            showTab(1);
            if (d != null && d.length() >= 2) startDeal(lex.fromRack(d));
            else startDeal(lex.challenge());
        } else if (w.length() >= 2) {
            showTab(0);
            checkQ.setText(w);
            doCheck(true);
        }
    }

    private void setEnabled(boolean on) {
        if (checkQ != null) checkQ.setEnabled(on);
        View go = findViewById(R.id.game_go);
        if (go != null) go.setEnabled(on);
        if (gameQ != null) gameQ.setEnabled(on);
    }

    private void applySystemInsets() {
        View root = findViewById(R.id.root);
        if (root == null) return;
        int extraTop = root.getPaddingTop();
        int extraBottom = root.getPaddingBottom();
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top;
            int bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                top = bars.top;
                bottom = bars.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(v.getPaddingLeft(), top + extraTop, v.getPaddingRight(), bottom + extraBottom);
            return insets;
        });
        root.requestApplyInsets();
    }

    private void paintBuildStamp() {
        TextView stamp = findViewById(R.id.about_version);
        if (stamp == null) return;
        String name = "3.1";
        int code = 20;
        try {
            android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (pi.versionName != null) name = pi.versionName;
            code = pi.versionCode;
        } catch (Exception ignored) {
        }
        stamp.setText(getString(R.string.build_stamp, name, code, BuildConfig.BUILD_TIME));
    }

    private void bindLang() {
        TextView fr = findViewById(R.id.lang_fr);
        TextView en = findViewById(R.id.lang_en);
        if (fr == null || en == null) return;
        paintLangToggle(fr, en);
        fr.setOnClickListener(v -> setLang(Lang.FR));
        en.setOnClickListener(v -> setLang(Lang.EN));
    }

    private void paintLangToggle(TextView fr, TextView en) {
        boolean english = Lang.isEn(this);
        styleLangChip(fr, !english);
        styleLangChip(en, english);
    }

    private void styleLangChip(TextView chip, boolean on) {
        chip.setTextColor(getColor(on ? R.color.tile_ink : R.color.gold));
        chip.setBackgroundResource(on ? R.drawable.bg_gold_btn : 0);
        chip.setContentDescription(getString(R.string.lang_switch) + " " + chip.getText());
    }

    private void setLang(String lang) {
        if (lang.equals(Lang.get(this))) return;
        Lang.set(this, lang);
        recreate();
    }

    private String fmtAvg(boolean has, double avg) {
        if (!has) return getString(R.string.avg_empty);
        String n = avg == Math.rint(avg)
                ? String.valueOf((int) avg)
                : String.format(Lang.isEn(this) ? java.util.Locale.US : java.util.Locale.FRANCE, "%.1f", avg);
        return getString(R.string.avg_score, n);
    }

    private String defMessage(String key) {
        if ("offline".equals(key)) return getString(R.string.def_need_net);
        if ("missing".equals(key)) return getString(R.string.def_missing);
        return key == null || key.isEmpty() ? getString(R.string.def_need_net) : key;
    }

    private String categoryLabel(String cat) {
        if ("bingo".equals(cat)) return getString(R.string.cat_bingo);
        if ("long".equals(cat)) return getString(R.string.cat_long);
        if ("hard".equals(cat)) return getString(R.string.cat_hard);
        return getString(R.string.challenge);
    }

    private void showTab(int which) {
        tab = which;
        paneCheck.setVisibility(which == 0 ? View.VISIBLE : View.GONE);
        paneGame.setVisibility(which == 1 ? View.VISIBLE : View.GONE);
        paneAbout.setVisibility(which == 2 ? View.VISIBLE : View.GONE);
        styleTab(tabCheck, which == 0);
        styleTab(tabGame, which == 1);
        styleTab(tabAbout, which == 2);
        brandSub.setText(which == 1
                ? getString(isCompetitiveMode ? R.string.competition : R.string.challenge)
                : which == 2 ? getString(R.string.tab_about_sub) : getString(R.string.brand_sub));
        if (which == 1 && lex != null && deal == null) {
            if (isCompetitiveMode) {
                // Competitive mode: fetch daily trail
                competitiveMode.fetchTrail(new CompetitiveMode.TrailCallback() {
                    @Override
                    public void onTrail(String trailId, String category, String rack) {
                        startDeal(lex.fromRack(rack));
                    }
                    @Override
                    public void onError(String message) {
                        Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
                        startDeal(lex.challenge());
                    }
                });
            } else {
                // Anonymous: use local challenge
                startDeal(lex.challenge());
            }
        }
    }

    private void styleTab(TextView t, boolean on) {
        t.setBackgroundResource(on ? R.drawable.bg_nav_on : R.drawable.bg_nav);
        int color = getColor(on ? R.color.tile_ink : R.color.dim);
        t.setTextColor(color);
        android.graphics.drawable.Drawable[] icons = t.getCompoundDrawables();
        for (android.graphics.drawable.Drawable icon : icons) {
            if (icon != null) icon.mutate().setTint(color);
        }
    }

    private void bindCheck() {
        checkQ = findViewById(R.id.check_q);
        checkCard = findViewById(R.id.check_card);
        checkStatus = findViewById(R.id.check_status);
        checkWord = findViewById(R.id.check_word);
        checkTiles = findViewById(R.id.check_tiles);
        checkMeta = findViewById(R.id.check_meta);
        checkPos = findViewById(R.id.check_pos);
        checkDef = findViewById(R.id.check_def);
        checkLemma = findViewById(R.id.check_lemma);
        checkWiki = findViewById(R.id.check_wiki);
        checkShare = findViewById(R.id.check_share);
        checkHint = findViewById(R.id.check_hint);
        checkModesScroll = findViewById(R.id.check_modes_scroll);
        checkModes = findViewById(R.id.check_modes);
        checkMatches = findViewById(R.id.check_matches);
        checkJoker = findViewById(R.id.check_joker);
        checkRackScroll = findViewById(R.id.check_rack_scroll);
        checkRackRow = findViewById(R.id.check_rack_row);
        checkRackCap = findViewById(R.id.check_rack_cap);
        checkLensScroll = findViewById(R.id.check_lens_scroll);
        checkLens = findViewById(R.id.check_lens);
        checkRackHelp = findViewById(R.id.check_rack_help);
        checkClear = findViewById(R.id.check_clear);
        if (checkClear != null) {
            checkClear.setOnClickListener(v -> {
                checkQ.setText("");
                checkQ.requestFocus();
            });
        }
        if (checkJoker != null) {
            checkJoker.setOnClickListener(v -> addJoker());
        }
        TextView ex = findViewById(R.id.check_rack_ex);
        if (ex != null) {
            ex.setOnClickListener(v -> {
                findMode = "rack";
                checkQ.setText("AERTIN?");
                checkQ.setSelection(checkQ.getText().length());
                paintModes();
                doCheck(false);
            });
        }
        checkQ.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { doCheck(false); }
            @Override public void afterTextChanged(Editable s) {}
        });
        checkQ.setOnEditorActionListener((v, action, e) -> {
            if (action == EditorInfo.IME_ACTION_SEARCH || action == EditorInfo.IME_ACTION_DONE
                    || (e != null && e.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
                doCheck(true);
                return true;
            }
            return false;
        });
        checkShare.setOnClickListener(v -> {
            if (lastShare != null) share(lastShare);
        });
    }

    private void doCheck(boolean immediateDef) {
        if (lex == null || checkQ == null) return;
        String mode = advanced ? findMode : "exact";
        String word = "rack".equals(mode)
                ? Lexicon.normalizeRack(checkQ.getText().toString())
                : Lexicon.normalize(checkQ.getText().toString());
        if (checkClear != null) checkClear.setVisibility(word.isEmpty() ? View.GONE : View.VISIBLE);
        if ("rack".equals(mode)) {
            checkCard.setVisibility(View.GONE);
            paintMatches(mode, word);
            return;
        }
        if (!"exact".equals(mode) && word.length() >= 1) {
            checkCard.setVisibility(View.GONE);
            paintMatches(mode, word);
            return;
        }
        if (checkMatches != null) checkMatches.setVisibility(View.GONE);
        if (word.length() < 2) {
            checkCard.setVisibility(View.GONE);
            checkHandler.removeCallbacksAndMessages(null);
            return;
        }
        boolean ok = lex.has(word);
        int pts = ok ? Lexicon.scoreWord(word, null) : 0;
        checkCard.setVisibility(View.VISIBLE);
        checkStatus.setText(ok ? R.string.playable : R.string.not_in_list);
        checkStatus.setTextColor(getColor(ok ? R.color.ok : R.color.no));
        checkWord.setText(word);
        Tiles.fill(checkTiles, word, null, null);
        checkMeta.setText(ok ? getString(R.string.letters_pts, word.length(), pts, pts > 1 ? "s" : "") : "");
        checkPos.setText("");
        checkDef.setText(ok ? R.string.def_pending : R.string.not_a_form);
        if (checkLemma != null) checkLemma.setVisibility(View.GONE);
        checkWiki.setVisibility(View.GONE);
        checkShare.setVisibility(View.VISIBLE);
        lastShare = ok
                ? getString(R.string.share_check_ok, word, word.length(), pts)
                : getString(R.string.share_check_no, word);
        if (!ok) {
            checkHandler.removeCallbacksAndMessages(null);
            return;
        }
        if (immediateDef) rememberChecked(word, pts);
        final String wanted = word;
        final String lang = Lang.get(this);
        final int seq = ++checkSeq;
        checkHandler.removeCallbacksAndMessages(null);
        Runnable fetch = () -> RemoteApi.define(wanted, new RemoteApi.DefCb() {
            @Override
            public void ok(String pos, String text, String url, String lemma) {
                if (seq != checkSeq) return;
                checkPos.setText(pos);
                paintDef(checkDef, checkLemma, text, lemma, wanted);
                checkWiki.setVisibility(View.VISIBLE);
                checkWiki.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))));
            }

            @Override
            public void empty(String message) {
                if (seq != checkSeq) return;
                checkPos.setText("");
                checkDef.setText(defMessage(message));
                if (checkLemma != null) checkLemma.setVisibility(View.GONE);
            }
        }, lang);
        if (immediateDef) fetch.run();
        else checkHandler.postDelayed(fetch, 180);
    }

    private void bindAuth() {
        authStatus = findViewById(R.id.auth_status);
        authGoogle = findViewById(R.id.auth_google);
        authLogout = findViewById(R.id.auth_logout);
        gameMode = findViewById(R.id.game_mode);
        gameBoard = findViewById(R.id.game_board);
        gameBoardTitle = findViewById(R.id.game_board_title);
        if (authGoogle != null) authGoogle.setOnClickListener(v -> competitiveMode.signIn(() -> {
            paintAuth();
            syncHistory();
        }));
        if (authLogout != null) authLogout.setOnClickListener(v -> {
            competitiveMode.signOut();
            isCompetitiveMode = false;
            paintAuth();
            paintHistory();
        });
        if (gameMode != null) gameMode.setOnClickListener(v -> {
            if (!isCompetitiveMode && !competitiveMode.loggedIn()) {
                competitiveMode.signIn(() -> {
                    isCompetitiveMode = true;
                    deal = null;
                    paintAuth();
                    syncHistory();
                    showTab(1);
                });
                return;
            }
            isCompetitiveMode = !isCompetitiveMode;
            deal = null;
            paintAuth();
            showTab(1);
        });
    }

    private void paintAuth() {
        boolean on = competitiveMode.loggedIn();
        if (authStatus != null) {
            authStatus.setText(on
                    ? getString(R.string.signed_in, competitiveMode.userName())
                    : getString(R.string.sign_in_hint));
        }
        if (authGoogle != null) authGoogle.setVisibility(on ? View.GONE : View.VISIBLE);
        if (authLogout != null) authLogout.setVisibility(on ? View.VISIBLE : View.GONE);
        if (gameMode != null) {
            gameMode.setText(isCompetitiveMode ? R.string.competition_on : R.string.competition);
        }
        paintHistory();
    }

    private void bindAdvanced() {
        advancedToggle = findViewById(R.id.advanced_toggle);
        if (advancedToggle != null) {
            advancedToggle.setChecked(advanced);
            advancedToggle.setOnCheckedChangeListener((CompoundButton button, boolean checked) -> {
                advanced = checked;
                getSharedPreferences("verimots-prefs", MODE_PRIVATE).edit().putBoolean("advanced", checked).apply();
                if (!checked) findMode = "exact";
                paintModes();
                doCheck(false);
            });
        }
        paintModes();
    }

    private void addJoker() {
        if (checkQ == null) return;
        String rack = Lexicon.normalizeRack(checkQ.getText().toString());
        int blanks = 0;
        for (int i = 0; i < rack.length(); i++) if (rack.charAt(i) == '?') blanks++;
        if (blanks >= 2 || rack.length() >= 16) return;
        checkQ.append("?");
        checkQ.setSelection(checkQ.getText().length());
    }

    private void paintModes() {
        boolean rack = advanced && "rack".equals(findMode);
        if (checkModesScroll != null) checkModesScroll.setVisibility(advanced ? View.VISIBLE : View.GONE);
        if (checkJoker != null) checkJoker.setVisibility(rack ? View.VISIBLE : View.GONE);
        if (checkQ != null) {
            checkQ.setFilters(new android.text.InputFilter[]{
                    new android.text.InputFilter.LengthFilter(rack ? 16 : 15)
            });
            int padEnd = (int) ((rack ? 100 : 48) * getResources().getDisplayMetrics().density);
            checkQ.setPadding(checkQ.getPaddingLeft(), checkQ.getPaddingTop(), padEnd, checkQ.getPaddingBottom());
            checkQ.setHint(rack ? "Ex. AERTIN?" : getString(R.string.word_hint));
        }
        if (checkHint != null) {
            int hint = R.string.hint_check;
            if (advanced) {
                if ("prefix".equals(findMode)) hint = R.string.hint_prefix;
                else if ("suffix".equals(findMode)) hint = R.string.hint_suffix;
                else if ("has".equals(findMode)) hint = R.string.hint_has;
                else if (rack) hint = R.string.hint_rack;
            }
            checkHint.setVisibility(rack ? View.GONE : View.VISIBLE);
            checkHint.setText(hint);
        }
        if (checkRackHelp != null && !rack) checkRackHelp.setVisibility(View.GONE);
        paintLens();
        paintRackPreview();
        if (checkModes == null) return;
        checkModes.removeAllViews();
        String[][] modes = {
                {"exact", getString(R.string.mode_exact)},
                {"prefix", getString(R.string.mode_prefix)},
                {"suffix", getString(R.string.mode_suffix)},
                {"has", getString(R.string.mode_has)},
                {"rack", getString(R.string.mode_rack)}
        };
        for (String[] mode : modes) {
            TextView chip = new TextView(this);
            chip.setText(mode[1]);
            chip.setTextColor(getColor(mode[0].equals(findMode) ? R.color.tile_ink : R.color.gold));
            chip.setBackgroundResource(mode[0].equals(findMode) ? R.drawable.bg_gold_btn : R.drawable.bg_pill);
            chip.setPadding(28, 16, 28, 16);
            chip.setTextSize(12);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.setMarginEnd(10);
            chip.setLayoutParams(lp);
            final String next = mode[0];
            chip.setOnClickListener(v -> {
                findMode = next;
                paintModes();
                doCheck(false);
            });
            checkModes.addView(chip);
        }
    }

    private void paintLens() {
        boolean on = advanced && "rack".equals(findMode);
        if (checkLensScroll != null) checkLensScroll.setVisibility(on ? View.VISIBLE : View.GONE);
        if (!on || checkLens == null) return;
        checkLens.removeAllViews();
        int[] lens = {0, 2, 3, 4, 5, 6, 7};
        String[] labels = {getString(R.string.len_all), "2", "3", "4", "5", "6", "7"};
        for (int i = 0; i < lens.length; i++) {
            TextView chip = new TextView(this);
            boolean sel = rackLen == lens[i];
            chip.setText(labels[i]);
            chip.setTextColor(getColor(sel ? R.color.tile_ink : R.color.gold));
            chip.setBackgroundResource(sel ? R.drawable.bg_gold_btn : R.drawable.bg_pill);
            chip.setPadding(26, 14, 26, 14);
            chip.setTextSize(12);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.setMarginEnd(8);
            chip.setLayoutParams(lp);
            final int next = lens[i];
            chip.setOnClickListener(v -> {
                rackLen = next;
                paintLens();
                doCheck(false);
            });
            checkLens.addView(chip);
        }
    }

    private void paintRackPreview() {
        boolean on = advanced && "rack".equals(findMode);
        String rack = on && checkQ != null ? Lexicon.normalizeRack(checkQ.getText().toString()) : "";
        if (checkRackScroll != null) checkRackScroll.setVisibility(on && !rack.isEmpty() ? View.VISIBLE : View.GONE);
        if (checkRackCap != null) {
            if (on) {
                int blanks = 0;
                for (int i = 0; i < rack.length(); i++) if (rack.charAt(i) == '?') blanks++;
                checkRackCap.setVisibility(View.VISIBLE);
                checkRackCap.setText(rack.isEmpty()
                        ? getString(R.string.rack_type_hint)
                        : getString(R.string.rack_cap, rack.length(), rack.length() > 1 ? "s" : "",
                                blanks > 0 ? getString(R.string.jokers_bit, blanks, blanks > 1 ? "s" : "") : ""));
            } else checkRackCap.setVisibility(View.GONE);
        }
        if (checkJoker != null) {
            int blanks = 0;
            for (int i = 0; i < rack.length(); i++) if (rack.charAt(i) == '?') blanks++;
            checkJoker.setAlpha(on && blanks < 2 && rack.length() < 16 ? 1f : 0.35f);
        }
        if (!on || checkRackRow == null) return;
        Tiles.fill(checkRackRow, rack, null, v -> {
            int i = (Integer) v.getTag();
            if (i < 0 || i >= rack.length() || checkQ == null) return;
            String next = rack.substring(0, i) + rack.substring(i + 1);
            checkQ.setText(next);
            checkQ.setSelection(next.length());
        });
        int blanks = 0;
        for (int i = 0; i < rack.length(); i++) if (rack.charAt(i) == '?') blanks++;
        if (blanks < 2 && rack.length() < 16) {
            TextView add = new TextView(this);
            float d = getResources().getDisplayMetrics().density;
            int size = (int) (42 * d);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, (int) (48 * d));
            if (checkRackRow.getChildCount() > 0) lp.setMarginStart((int) (6 * d));
            add.setLayoutParams(lp);
            add.setGravity(android.view.Gravity.CENTER);
            add.setText("?+");
            add.setTextColor(getColor(R.color.gold));
            add.setTextSize(14);
            add.setBackgroundResource(R.drawable.bg_pill);
            add.setOnClickListener(v -> addJoker());
            checkRackRow.addView(add);
        }
    }

    private void paintMatches(String mode, String query) {
        if (checkMatches == null || lex == null) return;
        checkMatches.removeAllViews();
        if ("rack".equals(mode)) {
            paintRackPreview();
            boolean empty = query.length() < 2;
            if (checkRackHelp != null) checkRackHelp.setVisibility(empty ? View.VISIBLE : View.GONE);
            if (empty) {
                checkMatches.setVisibility(View.GONE);
                return;
            }
            checkMatches.setVisibility(View.VISIBLE);
            int min = rackLen == 0 ? 2 : rackLen;
            int max = rackLen == 0 ? Math.min(15, query.length()) : rackLen;
            List<Lexicon.Play> plays = lex.anagrams(query, min, max);
            @SuppressWarnings("unchecked")
            ArrayList<Lexicon.Play>[] by = new ArrayList[16];
            int total = 0;
            for (Lexicon.Play p : plays) {
                int len = p.word.length();
                if (len < 2 || len > 15) continue;
                if (by[len] == null) by[len] = new ArrayList<>();
                if (by[len].size() < 40) by[len].add(p);
                total++;
            }
            TextView sum = new TextView(this);
            sum.setText(getString(R.string.playable_count, total, total > 1 ? "s" : "", total > 1 ? "s" : ""));
            sum.setTextColor(getColor(R.color.muted));
            sum.setTextSize(13);
            sum.setPadding(0, 0, 0, 10);
            checkMatches.addView(sum);
            if (total == 0) {
                TextView emptyMsg = new TextView(this);
                emptyMsg.setText(R.string.no_rack_words);
                emptyMsg.setTextColor(getColor(R.color.dim));
                checkMatches.addView(emptyMsg);
                return;
            }
            for (int len = 15; len >= 2; len--) {
                if (by[len] == null || by[len].isEmpty()) continue;
                TextView head = new TextView(this);
                head.setText(getString(R.string.letters_n, len) + " · " + by[len].size());
                head.setTextColor(getColor(R.color.gold));
                head.setTextSize(13);
                head.setPadding(0, 14, 0, 8);
                checkMatches.addView(head);
                FlowLayout row = new FlowLayout(this);
                for (Lexicon.Play p : by[len]) {
                    TextView chip = Tiles.resultChip(this, p.word, p.pts(), p.jokers);
                    chip.setOnClickListener(v -> openExact(p.word));
                    row.addView(chip);
                }
                checkMatches.addView(row);
            }
            return;
        }
        if (checkRackHelp != null) checkRackHelp.setVisibility(View.GONE);
        if (checkRackScroll != null) checkRackScroll.setVisibility(View.GONE);
        checkMatches.setVisibility(View.VISIBLE);
        List<String> hits = lex.find(mode, query, 40);
        TextView count = new TextView(this);
        count.setText(getString(R.string.word_count_label, hits.size() >= 40 ? hits.size() + "+" : String.valueOf(hits.size()), hits.size() > 1 ? "s" : ""));
        count.setTextColor(getColor(R.color.dim));
        checkMatches.addView(count);
        FlowLayout row = new FlowLayout(this);
        for (String hit : hits) {
            TextView chip = Tiles.resultChip(this, hit, Lexicon.scoreWord(hit, null), null);
            chip.setOnClickListener(v -> openExact(hit));
            row.addView(chip);
        }
        checkMatches.addView(row);
    }

    private void openExact(String word) {
        findMode = "exact";
        paintModes();
        checkQ.setText(word);
        checkQ.setSelection(word.length());
        doCheck(true);
    }

    private void openLemma(String lemma) {
        String word = Lexicon.normalize(lemma);
        if (word.length() < 2) return;
        showTab(0);
        openExact(word);
    }

    private void paintDef(TextView def, TextView see, String text, String apiLemma, String current) {
        if (def == null) return;
        String extracted = Defs.extractFormOf(text);
        if (extracted.isEmpty() && apiLemma != null && !apiLemma.isEmpty()) {
            String folded = Lexicon.normalize(apiLemma);
            if (!folded.isEmpty() && current != null && !folded.equals(Lexicon.normalize(current))) extracted = apiLemma;
        }
        final String form = extracted;
        if (form.isEmpty()) {
            def.setText(text);
            def.setMovementMethod(null);
            if (see != null) see.setVisibility(View.GONE);
            return;
        }
        SpannableString span = new SpannableString(text);
        String hay = text.toLowerCase(java.util.Locale.FRENCH);
        String needle = form.toLowerCase(java.util.Locale.FRENCH);
        int at = hay.lastIndexOf(needle);
        if (at >= 0) {
            final String go = form;
            span.setSpan(
                    new ClickableSpan() {
                        @Override
                        public void onClick(View widget) {
                            openLemma(go);
                        }

                        @Override
                        public void updateDrawState(TextPaint ds) {
                            ds.setColor(getColor(R.color.gold));
                            ds.setUnderlineText(true);
                        }
                    },
                    at,
                    at + form.length(),
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        def.setText(span);
        def.setMovementMethod(LinkMovementMethod.getInstance());
        def.setHighlightColor(getColor(R.color.gold_soft));
        if (see != null) {
            see.setVisibility(View.VISIBLE);
            see.setText(getString(R.string.see_lemma, form));
            see.setOnClickListener(v -> openLemma(form));
        }
    }

    private void rememberChecked(String word, int pts) {
        HistoryStore.remember(this, word, pts, "dico");
        if (competitiveMode.loggedIn()) RemoteApi.saveHistory(word, pts, "dico");
        paintHistory();
    }

    private void syncHistory() {
        if (!competitiveMode.loggedIn()) return;
        RemoteApi.fetchHistory(new RemoteApi.HistoryCb() {
            @Override
            public void ok(org.json.JSONArray history, org.json.JSONObject stats) {
                HistoryStore.merge(MainActivity.this, history);
                if (authStats != null && stats != null) {
                    int streak = stats.optInt("streak");
                    int best = stats.optInt("best");
                    int words = stats.optInt("words");
                    String bits = "";
                    if (streak > 0) bits += streak + " j";
                    if (best > 0) bits += (bits.isEmpty() ? "" : " · ") + "best " + best + " %";
                    if (words > 0) bits += (bits.isEmpty() ? "" : " · ") + words + " mot" + (words > 1 ? "s" : "");
                    authStats.setText(bits);
                    authStats.setVisibility(bits.isEmpty() ? View.GONE : View.VISIBLE);
                }
                paintHistory();
            }

            @Override
            public void error(String message) {
                paintHistory();
            }
        });
    }

    private void paintHistory() {
        authStats = findViewById(R.id.auth_stats);
        authHistory = findViewById(R.id.auth_history);
        if (authHistory == null) return;
        authHistory.removeAllViews();
        List<HistoryStore.Row> rows = HistoryStore.load(this);
        if (rows.isEmpty()) return;
        TextView title = new TextView(this);
        title.setText(competitiveMode.loggedIn() ? R.string.hist_account : R.string.hist_local);
        title.setTextColor(getColor(R.color.gold));
        title.setTextSize(12);
        title.setPadding(0, 8, 0, 6);
        authHistory.addView(title);
        int n = Math.min(12, rows.size());
        for (int i = 0; i < n; i++) {
            HistoryStore.Row row = rows.get(i);
            TextView line = new TextView(this);
            line.setText(row.word + "  " + row.pts + "  ·  " + getString("defi".equals(row.src) ? R.string.src_game : R.string.src_check));
            line.setTextColor(getColor(R.color.muted));
            line.setTextSize(14);
            line.setPadding(0, 8, 0, 8);
            line.setOnClickListener(v -> {
                showTab(0);
                findMode = "exact";
                paintModes();
                checkQ.setText(row.word);
                checkQ.setSelection(row.word.length());
                doCheck(true);
            });
            authHistory.addView(line);
        }
    }

    private void bindGame() {
        gameRack = findViewById(R.id.game_rack);
        gameForm = findViewById(R.id.game_form);
        gameQ = findViewById(R.id.game_q);
        gameLive = findViewById(R.id.game_live);
        gameCat = findViewById(R.id.game_cat);
        gameAvg = findViewById(R.id.game_avg);
        gameResult = findViewById(R.id.game_result);
        gamePct = findViewById(R.id.game_pct);
        gameBreak = findViewById(R.id.game_break);
        gameVs = findViewById(R.id.game_vs);
        gameTop = findViewById(R.id.game_top);
        gamePos = findViewById(R.id.game_pos);
        gameDef = findViewById(R.id.game_def);
        gameLemma = findViewById(R.id.game_lemma);
        gameWa = findViewById(R.id.game_wa);
        gameChart = findViewById(R.id.game_chart);
        gameLast = findViewById(R.id.game_last);
        gameLastUnit = findViewById(R.id.game_last_unit);
        gameSpacer = findViewById(R.id.game_spacer);
        findViewById(R.id.game_go).setOnClickListener(v -> submitPlay());
        findViewById(R.id.game_again).setOnClickListener(v -> {
            if (lex == null) return;
            deal = null;
            showTab(1);
        });
        gameQ.setOnEditorActionListener((v, a, e) -> {
            if (a == EditorInfo.IME_ACTION_DONE) {
                submitPlay();
                return true;
            }
            return false;
        });
        gameQ.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { previewPlay(); }
            @Override public void afterTextChanged(Editable s) {}
        });
        gameWa.setOnClickListener(v -> {
            if (waText != null) share(waText);
        });
    }

    private void startDeal(Lexicon.Deal next) {
        deal = next;
        closed = false;
        gameQ.setText("");
        gameQ.setEnabled(true);
        gameForm.setVisibility(View.VISIBLE);
        gameLive.setVisibility(View.VISIBLE);
        gameLive.setText("");
        gameResult.setVisibility(View.GONE);
        if (gameSpacer != null) gameSpacer.setVisibility(View.VISIBLE);
        gameCat.setText(categoryLabel(next.category));
        paintRack();
        paintShare(null);
    }

    private Set<Integer> usedTiles(String word) {
        HashSet<Integer> used = new HashSet<>();
        if (deal == null) return used;
        String rack = deal.rack;
        for (int i = 0; i < word.length(); i++) {
            char ch = word.charAt(i);
            for (int j = 0; j < rack.length(); j++) {
                if (!used.contains(j) && rack.charAt(j) == ch) {
                    used.add(j);
                    break;
                }
            }
        }
        return used;
    }

    private void paintRack() {
        if (deal == null) return;
        String typed = Lexicon.normalize(gameQ.getText().toString());
        Tiles.fill(gameRack, deal.rack, closed ? null : usedTiles(typed), closed ? null : v -> {
            int i = (Integer) v.getTag();
            char ch = deal.rack.charAt(i);
            String word = Lexicon.normalize(gameQ.getText().toString());
            Set<Integer> used = usedTiles(word);
            if (used.contains(i)) {
                int cut = word.lastIndexOf(ch);
                if (cut >= 0) word = word.substring(0, cut) + word.substring(cut + 1);
            } else word = word + ch;
            gameQ.setText(word);
            gameQ.setSelection(word.length());
        });
    }

    private void previewPlay() {
        if (closed || deal == null) return;
        paintRack();
        String word = Lexicon.normalize(gameQ.getText().toString());
        if (word.isEmpty()) {
            gameLive.setText("");
            return;
        }
        Lexicon.Play hit = lex.findPlay(deal.catalog, word);
        if (hit != null) {
            gameLive.setText(getString(R.string.pts_n, hit.pts()));
            gameLive.setTextColor(getColor(R.color.ok));
        } else if (word.length() >= 2) {
            gameLive.setText(R.string.not_on_rack);
            gameLive.setTextColor(getColor(R.color.no));
        } else gameLive.setText("");
    }

    private void submitPlay() {
        if (closed || deal == null || lex == null) return;
        String word = Lexicon.normalize(gameQ.getText().toString());
        Lexicon.Play hit = lex.findPlay(deal.catalog, word);
        if (hit == null) {
            gameLive.setText(word.length() < 2 ? R.string.need_best : R.string.not_playable);
            gameLive.setTextColor(getColor(R.color.no));
            return;
        }
        closed = true;
        gameQ.setEnabled(false);
        gameForm.setVisibility(View.GONE);
        gameLive.setVisibility(View.GONE);
        paintRack();
        Lexicon.Play best = deal.catalog.isEmpty() ? hit : deal.catalog.get(0);
        int percent = Math.min(100, Math.round(100f * hit.pts() / Math.max(1, best.pts())));
        boolean same = best.word.equals(hit.word);
        String vs = same ? getString(R.string.best_word) : percent >= 100
                ? getString(R.string.tied, best.word, best.pts())
                : getString(R.string.top_word, best.word, best.pts());
        gamePct.setText(percent + "%");
        gameBreak.setText(hit.word + " " + hit.pts());
        gameVs.setText(vs);
        gameResult.setVisibility(View.VISIBLE);
        if (gameSpacer != null) gameSpacer.setVisibility(View.GONE);
        List<Lexicon.Play> tops = Lexicon.topWords(deal.catalog, hit, 5);
        int start = 0;
        for (int i = 0; i < tops.size(); i++) if (tops.get(i).word.equals(hit.word)) start = i;
        paintTops(tops, start, hit.word);
        showDef(tops.get(start).word);
        List<Integer> scores = ScoreStore.add(this, percent);
        paintChart(scores);
        paintShare(percent);
        RemoteApi.postScore(percent, (has, avg) -> gameAvg.setText(fmtAvg(has, avg)));
        HistoryStore.remember(this, hit.word, hit.pts(), "defi");
        if (competitiveMode.loggedIn()) RemoteApi.saveHistory(hit.word, hit.pts(), "defi");
        paintHistory();
        if (isCompetitiveMode && competitiveMode.loggedIn()) {
            competitiveMode.submitScore(percent, hit.word);
            competitiveMode.fetchBoard(gameBoard, gameBoardTitle);
        }
    }

    private void paintTops(List<Lexicon.Play> tops, int selected, String mine) {
        gameTop.removeAllViews();
        for (int i = 0; i < tops.size(); i++) {
            Lexicon.Play p = tops.get(i);
            TextView chip = Tiles.chip(this, p.word, p.pts(), i == selected, p.word.equals(mine));
            final int idx = i;
            chip.setOnClickListener(v -> {
                paintTops(tops, idx, mine);
                showDef(p.word);
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT);
            gameTop.addView(chip);
        }
    }

    private void showDef(String word) {
        gamePos.setText("");
        gameDef.setText(R.string.def_pending);
        if (gameLemma != null) gameLemma.setVisibility(View.GONE);
        RemoteApi.define(word, new RemoteApi.DefCb() {
            @Override
            public void ok(String pos, String text, String url, String lemma) {
                gamePos.setText(pos);
                paintDef(gameDef, gameLemma, text, lemma, word);
            }

            @Override
            public void empty(String message) {
                gamePos.setText("");
                gameDef.setText(defMessage(message));
                if (gameLemma != null) gameLemma.setVisibility(View.GONE);
            }
        }, Lang.get(this));
    }

    private void paintShare(Integer percent) {
        if (deal == null) {
            gameWa.setVisibility(View.INVISIBLE);
            return;
        }
        StringBuilder tiles = new StringBuilder();
        for (int i = 0; i < deal.rack.length(); i++) {
            if (i > 0) tiles.append(' ');
            tiles.append(deal.rack.charAt(i));
        }
        String score = percent != null ? getString(R.string.share_game_score, percent) : "\n";
        waText = getString(R.string.share_game, tiles.toString(), score, deal.rack, deal.category);
        gameWa.setVisibility(View.VISIBLE);
    }

    private void paintChart() {
        paintChart(ScoreStore.load(this));
    }

    private void paintChart(List<Integer> scores) {
        gameChart.setScores(scores);
        boolean has = scores != null && !scores.isEmpty();
        if (gameLast != null) gameLast.setText(has ? String.valueOf(scores.get(scores.size() - 1)) : "");
        if (gameLastUnit != null) gameLastUnit.setVisibility(has ? View.VISIBLE : View.GONE);
    }

    private void share(String text) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, text);
        startActivity(Intent.createChooser(i, getString(R.string.share)));
    }

    @Override
    public void onBackPressed() {
        if (tab != 0) showTab(0);
        else super.onBackPressed();
    }
}
