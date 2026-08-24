package cc.pfa87.ods9;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import android.text.format.DateFormat;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.Editable;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextPaint;
import android.text.TextWatcher;
import android.text.method.LinkMovementMethod;
import android.text.style.ClickableSpan;
import android.text.style.StyleSpan;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.widget.EditText;
import android.widget.CompoundButton;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private Lexicon lex;
    private View paneCheck;
    private View paneGame;
    private View paneAbout;
    private TextView tabCheck;
    private TextView tabGame;
    private TextView tabAbout;
    private View dictPop;
    private View gameBoardWrap;
    private View studyDefPanel;
    private TextView studyDefHead;
    private TextView studyDefBody;
    private TextView studyDefLemma;
    private TextView studyFav;
    private String studyDefWord = "";
    private String studyDefShown = "";
    private int studyDefSeq;
    private View tabBar;
    private boolean imeOpen;
    private TextView live;
    private TextView brandSub;
    private int tab;
    private boolean welcomeCompetition = true;
    
    private CompetitiveMode competitiveMode;
    private boolean isCompetitiveMode = false;
    private boolean isKidsMode = false;
    private boolean isTrainingMode = false;
    private TextView gameKids;
    private TextView gameTraining;
    private TextView gameHint;
    private int hintLevel;

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
    private TextView histOpen;
    private Dialog historyDialog;
    private Dialog favoritesDialog;
    private LinearLayout historyList;
    private boolean officialDeal;
    private boolean bubblesOn;
    private int dealRequestGeneration;
    private boolean rankedSubmitInFlight;
    private int rankedSubmitGeneration;
    private int pendingRankedPercent = -1;
    private String pendingRankedWord = "";
    private boolean advanced;
    private String findMode = "exact";
    private String lastShare;
    private String lastPlayedWord = "";
    private int lastPlayedPts;
    private String lastPlayedDef = "";
    private TextView aboutDict;
    private View checkClear;
    private View gameClear;
    private View gameSkip;
    private TextView gameAlpha;
    private View gameRackTools;
    private boolean rackAlpha;
    private boolean alphaBtnOn;
    private TextView gameFav;
    private TextView checkFav;
    private String gameDefWord = "";
    private String checkWordShown = "";
    // Which game the user picked in the menu — the header title follows this,
    // never the deal's category alone (a "hard letters" draw inside Find a
    // word used to read as a silent switch to Bingo).
    private String gameKind = "bingo";
    // Rack tiles selected by tapping, in word order. Keyboard edits fall back
    // to greedy matching; taps keep the exact tile that was touched, so twin
    // letters never steal each other's highlight.
    private final ArrayList<Integer> pickedTiles = new ArrayList<>();
    private View gameMenu;
    private View gamePlay;
    private View gameStudy;
    private TextView aboutLex;
    private TextView gameStudyBody;
    private TextView levelBeginner;
    private TextView levelConfirmed;
    private final Handler checkHandler = new Handler(Looper.getMainLooper());
    private int checkSeq;
    private TextView authStatus;
    private TextView authGoogle;
    private TextView authLogout;
    private TextView gameMode;
    private View trainingTools;
    private TextView trainingPresetBtn;
    private TextView trainingMinBtn;
    private int trainingMinLen = 5;
    private TextView trainingProgress;
    private TextView trainingTimerView;
    private TextView trainingReveal;
    private String trainingPreset = "all";
    private final HashSet<String> trainingFound = new HashSet<>();
    private final HashSet<String> trainingNeeded = new HashSet<>();
    private final Handler trainingHandler = new Handler(Looper.getMainLooper());
    private int trainingTimerSeconds;
    private long trainingEndsAt;
    private boolean trainingRecorded;
    private LinearLayout gameBoard;
    private TextView gameBoardTitle;
    private TextView boardTabGeneral;
    private TextView boardTabKids;
    private boolean boardKidsTab;

    private LinearLayout gameRack;
    private LinearLayout gameForm;
    private EditText gameQ;
    private TextView gameLive;
    private TextView gameCat;
    private View gameAgain;
    private TextView gameAvg;
    private boolean publicAverageHas;
    private double publicAverage;
    private ScrollView gameResult;
    private TextView gamePct;
    private TextView gameBreak;
    private TextView gameVs;
    private LinearLayout gameTop;
    private TextView gamePos;
    private TextView gameDef;
    private TextView gameLemma;
    private ImageButton gameWa;
    private ScoreChartView gameChart;
    private TextView gameChartAvg;
    private TextView gameChartAvgUnit;
    private TextView gameLast;
    private TextView gameLastUnit;
    private TextView boardChartAvg;
    private TextView boardChartAvgUnit;
    private ScoreChartView boardChart;
    private TextView boardChartLast;
    private View gameSpacer;
    private View gameDock;
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
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(false);
        bars.setAppearanceLightNavigationBars(false);
        setContentView(R.layout.activity_main);
        applySystemInsets();

        paneCheck = findViewById(R.id.pane_check);
        paneGame = findViewById(R.id.pane_game);
        paneAbout = findViewById(R.id.pane_about);
        tabCheck = findViewById(R.id.tab_check);
        tabGame = findViewById(R.id.tab_game);
        tabAbout = findViewById(R.id.tab_about);
        tabBar = findViewById(R.id.tabs);
        live = findViewById(R.id.live);
        brandSub = findViewById(R.id.brand_sub);
        aboutLex = findViewById(R.id.about_lex);
        dictPop = findViewById(R.id.dict_pop);
        gameBoardWrap = findViewById(R.id.game_board_wrap);
        studyDefPanel = findViewById(R.id.study_def_panel);
        studyDefHead = findViewById(R.id.study_def_head);
        studyDefBody = findViewById(R.id.study_def_body);
        studyDefLemma = findViewById(R.id.study_def_lemma);
        studyFav = findViewById(R.id.study_fav);
        if (brandSub != null) brandSub.setOnClickListener(v -> toggleDictPop());
        View.OnTouchListener closeDict = (v, e) -> {
            setDictPopOpen(false);
            return false;
        };
        if (paneCheck != null) paneCheck.setOnTouchListener(closeDict);
        if (paneGame != null) paneGame.setOnTouchListener(closeDict);
        if (paneAbout != null) paneAbout.setOnTouchListener(closeDict);
        View.OnClickListener goHome = v -> {
            if (checkQ != null) checkQ.setText("");
            showTab(1);
            boolean playOn = gamePlay != null && gamePlay.getVisibility() == View.VISIBLE;
            boolean studyOn = gameStudy != null && gameStudy.getVisibility() == View.VISIBLE;
            if (!playOn && !studyOn) openWelcomeCompetition();
        };
        View mark = findViewById(R.id.mark);
        View brandTitle = findViewById(R.id.brand_title);
        if (mark != null) mark.setOnClickListener(goHome);
        if (brandTitle != null) brandTitle.setOnClickListener(goHome);
        tabCheck.setOnClickListener(v -> showTab(0));
        tabGame.setOnClickListener(v -> {
            if (tab == 1) showGameView("menu");
            else showTab(1);
        });
        tabAbout.setOnClickListener(v -> showTab(2));

        competitiveMode = new CompetitiveMode(this);
        advanced = getSharedPreferences("verimots-prefs", MODE_PRIVATE).getBoolean("advanced", false);
        bubblesOn = getSharedPreferences("verimots-prefs", MODE_PRIVATE).getBoolean("bubbles", false);
        paintBuildStamp();
        bindLang();
        bindDicts();
        bindCheck();
        bindGame();
        bindGameMenu();
        bindAuth();
        bindAdvanced();
        bindStudy();
        bindFeedback();
        paintAuth();
        paintHistory();
        if (competitiveMode.loggedIn()) syncHistory();
        paintChart();
        setEnabled(false);
        new Thread(() -> {
            try {
                lex = Lexicon.get(this, Dict.get(this));
                runOnUiThread(() -> {
                    paintWordCount();
                    setEnabled(true);
                    paintStudy();
                    applyIntent(getIntent());
                    maybeOpenWelcomeCompetition();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    if (aboutLex != null) aboutLex.setText(R.string.lex_unavailable);
                    if (live != null) live.setText(R.string.lex_unavailable);
                });
            }
        }).start();
        android.content.SharedPreferences prefs = getSharedPreferences("verimots-prefs", MODE_PRIVATE);
        if (!prefs.getBoolean("nav-v3", false)) {
            prefs.edit().putBoolean("nav-v3", true).putInt("tab", 1).apply();
        }
        int savedTab = prefs.getInt("tab", 1);
        if (savedTab > 2) savedTab = 2;
        showTab(savedTab);
        applyBubbles();
        RemoteApi.fetchAverage((has, avg) -> {
            publicAverageHas = has;
            publicAverage = avg;
            paintGameAverage();
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyIntent(intent);
    }

    private void applyIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri u = intent.getData();
        String token = u.getQueryParameter("token");
        if (token == null || token.isEmpty()) token = u.getQueryParameter("app_auth");
        String path = u.getPath() == null ? "" : u.getPath();
        boolean appAuth = ("verimots".equals(u.getScheme()) && "auth".equals(u.getHost()))
                || path.contains("auth-android");
        if (appAuth && token != null && !token.isEmpty()) {
            competitiveMode.finishWebSignIn(token, () -> {
                paintAuth();
                syncHistory();
            });
            return;
        }
        if (lex == null) return;
        String vue = u.getQueryParameter("vue");
        String w = Lexicon.normalize(u.getQueryParameter("w"));
        String d = Lexicon.normalize(u.getQueryParameter("d"));
        if ("jeu".equals(vue) || (d != null && d.length() >= 2)) {
            welcomeCompetition = false;
            gameKind = "find";
            showTab(1);
            showGameView("play");
            if (d != null && d.length() >= 2) startDeal(lex.fromRack(d));
            else startDeal(lex.challenge());
        } else if (w.length() >= 2) {
            welcomeCompetition = false;
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
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboard = ime.bottom > bars.bottom + 40;
            v.setPadding(
                    v.getPaddingLeft(),
                    bars.top + extraTop,
                    v.getPaddingRight(),
                    Math.max(bars.bottom, ime.bottom) + extraBottom);
            setImeOpen(keyboard);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
    }

    private void setImeOpen(boolean on) {
        if (imeOpen == on) return;
        imeOpen = on;
        if (tabBar != null) tabBar.setVisibility(on ? View.GONE : View.VISIBLE);
        syncGameDock();
    }

    private void syncGameDock() {
        if (gameDock == null) return;
        boolean playOn = tab == 1 && gamePlay != null && gamePlay.getVisibility() == View.VISIBLE;
        if (imeOpen || !playOn || isTrainingMode) {
            gameDock.setVisibility(View.GONE);
            return;
        }
        java.util.List<Integer> scores = ScoreStore.load(this, isKidsMode);
        boolean has = scores != null && !scores.isEmpty();
        boolean share = gameWa != null && gameWa.getVisibility() == View.VISIBLE;
        gameDock.setVisibility(has || share ? View.VISIBLE : View.GONE);
        if (gameChart != null) gameChart.setVisibility(has ? View.VISIBLE : View.INVISIBLE);
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
        RemoteApi.setAppLabel(name, code);
        stamp.setText(getString(R.string.build_stamp, name, code, BuildConfig.BUILD_TIME));
    }

    private void bindDicts() {
        View fr = findViewById(R.id.dict_fr);
        View en = findViewById(R.id.dict_en);
        View wow = findViewById(R.id.dict_wow24);
        View es = findViewById(R.id.dict_es);
        if (fr == null || en == null || wow == null || es == null) return;
        fr.setOnClickListener(v -> setDictionary(Dict.ODS));
        en.setOnClickListener(v -> setDictionary(Dict.CSW));
        wow.setOnClickListener(v -> setDictionary(Dict.WOW24));
        es.setOnClickListener(v -> setDictionary(Dict.RLA));
        View popOds = findViewById(R.id.pop_dict_ods);
        View popCsw = findViewById(R.id.pop_dict_csw);
        View popWow = findViewById(R.id.pop_dict_wow24);
        View popRla = findViewById(R.id.pop_dict_rla);
        if (popOds != null) popOds.setOnClickListener(v -> pickDict(Dict.ODS));
        if (popCsw != null) popCsw.setOnClickListener(v -> pickDict(Dict.CSW));
        if (popWow != null) popWow.setOnClickListener(v -> pickDict(Dict.WOW24));
        if (popRla != null) popRla.setOnClickListener(v -> pickDict(Dict.RLA));
        paintDicts();
    }

    private void pickDict(String dict) {
        setDictPopOpen(false);
        setDictionary(dict);
    }

    private void toggleDictPop() {
        setDictPopOpen(dictPop == null || dictPop.getVisibility() != View.VISIBLE);
    }

    private void setDictPopOpen(boolean on) {
        if (dictPop == null) return;
        dictPop.setVisibility(on ? View.VISIBLE : View.GONE);
        paintDictPop();
    }

    private void paintDictPop() {
        if (dictPop == null) return;
        String dict = Dict.get(this);
        styleDictPopItem(findViewById(R.id.pop_dict_ods), Dict.ODS.equals(dict));
        styleDictPopItem(findViewById(R.id.pop_dict_csw), Dict.CSW.equals(dict));
        styleDictPopItem(findViewById(R.id.pop_dict_wow24), Dict.WOW24.equals(dict));
        styleDictPopItem(findViewById(R.id.pop_dict_rla), Dict.RLA.equals(dict));
    }

    private void styleDictPopItem(View row, boolean on) {
        if (!(row instanceof TextView)) return;
        TextView tv = (TextView) row;
        tv.setBackgroundResource(on ? R.drawable.bg_chip_on : 0);
        tv.setTextColor(getColor(on ? R.color.gold : R.color.ink));
    }

    private void paintDicts() {
        View fr = findViewById(R.id.dict_fr);
        View en = findViewById(R.id.dict_en);
        View wow = findViewById(R.id.dict_wow24);
        View es = findViewById(R.id.dict_es);
        if (fr == null || en == null || wow == null || es == null) return;
        String dict = Dict.get(this);
        styleDictRow(fr, Dict.ODS.equals(dict));
        styleDictRow(en, Dict.CSW.equals(dict));
        styleDictRow(wow, Dict.WOW24.equals(dict));
        styleDictRow(es, Dict.RLA.equals(dict));
        paintDictBadge();
    }

    private void paintDictBadge() {
        if (brandSub == null) return;
        String label = Dict.label(this);
        brandSub.setText(label);
        brandSub.setContentDescription(getString(R.string.dict_open) + " · " + label);
    }

    private void paintWordCount() {
        if (lex == null) return;
        java.util.Locale locale = new java.util.Locale(Lang.get(this));
        String n = String.format(locale, "%,d", lex.size()).replace('\u00a0', ' ');
        String label = getString(R.string.word_count, n);
        SpannableString bold = new SpannableString(label);
        int end = Math.min(n.length(), label.length());
        bold.setSpan(new StyleSpan(Typeface.BOLD), 0, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (aboutLex != null) aboutLex.setText(bold);
        if (live != null) live.setText(label);
        paintDictBadge();
    }

    private void styleDictRow(View row, boolean on) {
        row.setBackgroundResource(on ? R.drawable.bg_chip_on : R.drawable.bg_chip);
        row.setSelected(on);
    }

    private void bindLang() {
        TextView fr = findViewById(R.id.lang_fr);
        TextView en = findViewById(R.id.lang_en);
        TextView es = findViewById(R.id.lang_es);
        if (fr == null || en == null || es == null) return;
        paintLangToggle(fr, en, es);
        paintDicts();
        fr.setOnClickListener(v -> setLang(Lang.FR));
        en.setOnClickListener(v -> setLang(Lang.EN));
        es.setOnClickListener(v -> setLang(Lang.ES));
    }

    private void paintLangToggle(TextView fr, TextView en, TextView es) {
        String lang = Lang.get(this);
        styleLangChip(fr, Lang.FR.equals(lang));
        styleLangChip(en, Lang.EN.equals(lang));
        styleLangChip(es, Lang.ES.equals(lang));
    }

    private void styleLangChip(TextView chip, boolean on) {
        chip.setTextColor(getColor(on ? R.color.tile_ink : R.color.gold));
        chip.setBackgroundResource(on ? R.drawable.bg_gold_btn : 0);
        chip.setContentDescription(getString(R.string.lang_switch) + " " + chip.getText());
    }

    private void setLang(String lang) {
        if (lang.equals(Lang.get(this))) return;
        Dict.syncFromLang(this, lang);
        Lang.set(this, lang);
        if (Build.VERSION.SDK_INT < 33) recreate();
    }

    private void setDictionary(String dict) {
        if (dict.equals(Dict.get(this))) return;
        String nextLang = Dict.langOf(dict);
        Dict.set(this, dict);
        paintDicts();
        if (!nextLang.equals(Lang.get(this))) {
            Lang.set(this, nextLang);
            if (Build.VERSION.SDK_INT < 33) recreate();
            return;
        }
        reloadLexicon();
    }

    private void reloadLexicon() {
        setEnabled(false);
        if (aboutLex != null) aboutLex.setText(R.string.loading);
        if (live != null) live.setText(R.string.loading);
        new Thread(() -> {
            try {
                lex = Lexicon.get(this, Dict.get(this));
                runOnUiThread(() -> {
                    paintWordCount();
                    setEnabled(true);
                    paintStudy();
                    if (tab == 1 && gamePlay != null && gamePlay.getVisibility() == View.VISIBLE) {
                        deal = null;
                        requestDeal();
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    if (aboutLex != null) aboutLex.setText(R.string.lex_unavailable);
                    if (live != null) live.setText(R.string.lex_unavailable);
                });
            }
        }).start();
    }

    private String fmtAvg(boolean has, double avg) {
        if (!has) return getString(R.string.avg_empty);
        java.util.Locale locale = Lang.isEn(this)
                ? java.util.Locale.US
                : Lang.isEs(this) ? new java.util.Locale("es", "ES") : java.util.Locale.FRANCE;
        String n = String.format(locale, "%.1f", avg);
        return getString(R.string.avg_score, n);
    }

    private String defMessage(String key) {
        if ("offline".equals(key)) return getString(R.string.def_need_net);
        if ("missing".equals(key)) return getString(R.string.def_missing);
        return key == null || key.isEmpty() ? getString(R.string.def_need_net) : key;
    }

    // The header names the game the user picked, full stop. The deal's
    // category ("hard letters", "long word"\u2026) used to leak in here and read
    // as the app hopping between games on every deal.
    private String kickerLabel(String cat) {
        if ("find".equals(gameKind)) return getString(R.string.kids_cat);
        if ("combi".equals(gameKind)) return getString(R.string.menu_training);
        if ("bingo".equals(gameKind)) return getString(R.string.menu_comp);
        return categoryLabel(cat);
    }

    private String categoryLabel(String cat) {
        if ("bingo".equals(cat)) return getString(R.string.cat_bingo);
        if ("long".equals(cat)) return getString(R.string.cat_long);
        if ("hard".equals(cat)) return getString(R.string.cat_hard);
        if ("kids".equals(cat)) return getString(R.string.kids_cat);
        if ("training-all".equals(cat)) return getString(R.string.training_all);
        if ("training-seven".equals(cat)) return getString(R.string.training_seven);
        if ("training-eight".equals(cat)) return getString(R.string.training_eight);
        if ("training-plusOne".equals(cat)) return getString(R.string.training_plus_one);
        if ("training-joker".equals(cat)) return getString(R.string.training_joker);
        if ("training-hard".equals(cat)) return getString(R.string.training_hard);
        return getString(R.string.challenge);
    }

    private void showTab(int which) {
        tab = which;
        getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                .edit().putInt("tab", which).apply();
        setDictPopOpen(false);
        paneCheck.setVisibility(which == 0 ? View.VISIBLE : View.GONE);
        paneGame.setVisibility(which == 1 ? View.VISIBLE : View.GONE);
        paneAbout.setVisibility(which == 2 ? View.VISIBLE : View.GONE);
        styleTab(tabCheck, which == 0);
        styleTab(tabGame, which == 1);
        styleTab(tabAbout, which == 2);
        paintDictBadge();
        if (which == 1) {
            boolean playOn = gamePlay != null && gamePlay.getVisibility() == View.VISIBLE;
            boolean studyOn = gameStudy != null && gameStudy.getVisibility() == View.VISIBLE;
            if (!playOn && !studyOn) {
                if (welcomeCompetition && lex != null) openWelcomeCompetition();
                else showGameView("menu");
            }
        }
    }

    private void requestDeal() {
        if (lex == null || deal != null || tab != 1) return;
        final int request = ++dealRequestGeneration;
        rankedSubmitGeneration++;
        rankedSubmitInFlight = false;
        pendingRankedPercent = -1;
        pendingRankedWord = "";
        final boolean requestKids = isKidsMode;
        final boolean requestCompetitive = isCompetitiveMode;
        final String requestLang = Lang.get(this);
        if (requestKids) {
            competitiveMode.fetchTrail(true, new CompetitiveMode.TrailCallback() {
                @Override
                public void onTrail(String trailId, String category, String rack) {
                    onTrail(trailId, category, rack, "");
                }

                @Override
                public void onTrail(String trailId, String category, String rack, String seed) {
                    if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                    RemoteApi.fetchBoard(trailId, requestLang, true, new RemoteApi.BoardCb() {
                        @Override
                        public void ok(org.json.JSONArray top, org.json.JSONObject me) {
                            if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                            officialDeal = competitiveMode.loggedIn();
                            startDeal(me != null ? lex.kidsDeal() : lex.fromRack(rack, seed));
                        }

                        @Override
                        public void error(String message) {
                            if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                            officialDeal = true;
                            startDeal(lex.fromRack(rack, seed));
                        }
                    });
                }

                @Override
                public void onError(String message) {
                    if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                    officialDeal = false;
                    startDeal(lex.kidsDeal());
                }
            });
        } else if (requestCompetitive) {
            competitiveMode.fetchTrail(new CompetitiveMode.TrailCallback() {
                @Override
                public void onTrail(String trailId, String category, String rack) {
                    if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                    RemoteApi.fetchBoard(trailId, requestLang, new RemoteApi.BoardCb() {
                        @Override
                        public void ok(org.json.JSONArray top, org.json.JSONObject me) {
                            if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                            officialDeal = competitiveMode.loggedIn();
                            startDeal(me != null ? lex.challenge() : lex.fromRack(rack));
                        }

                        @Override
                        public void error(String message) {
                            if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                            officialDeal = true;
                            startDeal(lex.fromRack(rack));
                        }
                    });
                }

                @Override
                public void onError(String message) {
                    if (!isDealRequestCurrent(request, requestKids, requestCompetitive, requestLang)) return;
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
                    officialDeal = false;
                    startDeal(lex.challenge());
                }
            });
        } else {
            officialDeal = false;
            startDeal(isTrainingMode ? lex.training(trainingPreset, trainingMinLen) : lex.challenge());
        }
    }

    private boolean isDealRequestCurrent(int request, boolean kids, boolean competitive, String lang) {
        return !isFinishing()
                && !isDestroyed()
                && request == dealRequestGeneration
                && tab == 1
                && deal == null
                && kids == isKidsMode
                && competitive == isCompetitiveMode
                && lang.equals(Lang.get(this));
    }

    private void styleTab(TextView t, boolean on) {
        t.setBackgroundResource(on ? R.drawable.bg_nav_on : R.drawable.bg_nav);
        int color = getColor(on ? R.color.gold : R.color.dim);
        t.setTextColor(color);
        android.graphics.drawable.Drawable[] icons = t.getCompoundDrawables();
        for (android.graphics.drawable.Drawable icon : icons) {
            if (icon != null) icon.mutate().setTint(color);
        }
    }

    /** The Tools tab shows/hides the floating bubbles (feedback + share) that
     *  used to sit permanently over the chart and results — the overlap the
     *  bottom bar could not resolve. Hidden by default during play. */
    private void toggleBubbles() {
        bubblesOn = !bubblesOn;
        getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                .edit().putBoolean("bubbles", bubblesOn).apply();
        applyBubbles();
    }

    private void applyBubbles() {
        View fab = findViewById(R.id.feedback_fab);
        if (fab != null) fab.setVisibility(View.GONE);
        if (gameWa != null && !bubblesOn) gameWa.setVisibility(View.INVISIBLE);
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
        checkFav = findViewById(R.id.check_fav);
        if (checkFav != null) {
            checkFav.setOnClickListener(v -> {
                if (checkWordShown.isEmpty() || lex == null) return;
                FavStore.toggle(this, checkWordShown, lex.score(checkWordShown, null));
                paintFavStar(checkFav, checkWordShown);
            });
        }
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
        if (checkQ == null) return;
        String typed = checkQ.getText().toString();
        if (checkClear != null) {
            checkClear.setVisibility(typed.trim().isEmpty() ? View.GONE : View.VISIBLE);
        }
        if (lex == null) return;
        String mode = advanced ? findMode : "exact";
        String word = "rack".equals(mode)
                ? Lexicon.normalizeRack(typed)
                : Lexicon.normalize(typed);
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
        int pts = ok ? lex.score(word, null) : 0;
        checkCard.setVisibility(View.VISIBLE);
        checkStatus.setText(ok
                ? getString(R.string.playable, Dict.label(this))
                : getString(R.string.not_in_list, Dict.label(this)));
        checkStatus.setTextColor(getColor(ok ? R.color.ok : R.color.no));
        checkWord.setText(word);
        checkWordShown = ok ? word : "";
        if (checkFav != null) {
            checkFav.setVisibility(ok ? View.VISIBLE : View.GONE);
            paintFavStar(checkFav, checkWordShown);
        }
        Tiles.fill(checkTiles, word, null, null);
        checkMeta.setText(ok ? getString(R.string.letters_pts, word.length(), pts, pts > 1 ? "s" : "") : "");
        checkPos.setText("");
        checkDef.setText(ok ? R.string.def_pending : R.string.not_a_form);
        if (checkLemma != null) checkLemma.setVisibility(View.GONE);
        checkWiki.setVisibility(View.GONE);
        checkShare.setVisibility(View.VISIBLE);
        lastShare = ok
                ? getString(R.string.share_check_ok, word, word.length(), pts, "", Dict.label(this))
                : getString(R.string.share_check_no, word, Dict.label(this));
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
                String def = text == null || text.isEmpty() ? "" : text + "\n";
                lastShare = getString(R.string.share_check_ok, wanted, wanted.length(), pts, def, Dict.label(MainActivity.this));
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

    private void bindGameMenu() {
        gameMenu = findViewById(R.id.game_menu);
        gamePlay = findViewById(R.id.game_play);
        gameStudy = findViewById(R.id.game_study);
        levelBeginner = findViewById(R.id.level_beginner);
        levelConfirmed = findViewById(R.id.level_confirmed);
        View menuComp = findViewById(R.id.menu_comp);
        View menuTraining = findViewById(R.id.menu_training);
        View menuFind = findViewById(R.id.menu_find);
        View menuStudy = findViewById(R.id.menu_study);
        View backPlay = findViewById(R.id.game_menu_back);
        View backStudy = findViewById(R.id.study_back);
        if (menuComp != null) menuComp.setOnClickListener(v -> pickGame("competitive"));
        if (menuTraining != null) menuTraining.setOnClickListener(v -> pickGame("training"));
        if (menuFind != null) menuFind.setOnClickListener(v -> pickGame("find"));
        if (menuStudy != null) menuStudy.setOnClickListener(v -> pickGame("study"));
        View hubBack = findViewById(R.id.game_hub_back);
        if (hubBack != null) hubBack.setOnClickListener(v -> showTab(0));
        if (backPlay != null) backPlay.setOnClickListener(v -> showGameView("menu"));
        if (backStudy != null) backStudy.setOnClickListener(v -> showGameView("menu"));
        if (levelBeginner != null) levelBeginner.setOnClickListener(v -> setLevel("beginner"));
        if (levelConfirmed != null) levelConfirmed.setOnClickListener(v -> setLevel("confirmed"));
        paintLevel();
        showGameView("menu");
    }

    private boolean beginnerLevel() {
        return "beginner".equals(getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                .getString("level", "confirmed"));
    }

    private void setLevel(String level) {
        getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                .edit().putString("level", "beginner".equals(level) ? "beginner" : "confirmed")
                .apply();
        paintLevel();
    }

    private void paintLevel() {
        boolean beginner = beginnerLevel();
        styleLevelChip(levelBeginner, beginner);
        styleLevelChip(levelConfirmed, !beginner);
    }

    private void styleLevelChip(TextView chip, boolean on) {
        if (chip == null) return;
        chip.setBackgroundResource(on ? R.drawable.bg_gold_btn : 0);
        chip.setTextColor(getColor(on ? R.color.tile_ink : R.color.ink));
    }

    private void showGameView(String view) {
        if (gameMenu != null) gameMenu.setVisibility("menu".equals(view) ? View.VISIBLE : View.GONE);
        if (gamePlay != null) gamePlay.setVisibility("play".equals(view) ? View.VISIBLE : View.GONE);
        if (gameStudy != null) gameStudy.setVisibility("study".equals(view) ? View.VISIBLE : View.GONE);
        if ("play".equals(view)) syncPlayBoard();
        else if (gameBoardWrap != null) gameBoardWrap.setVisibility(View.GONE);
        syncGameDock();
    }

    private void pickGame(String choice) {
        if ("study".equals(choice)) {
            paintStudy();
            showGameView("study");
            return;
        }
        isCompetitiveMode = "competitive".equals(choice);
        isTrainingMode = "training".equals(choice);
        isKidsMode = "find".equals(choice) && beginnerLevel();
        gameKind = isCompetitiveMode ? "bingo" : isTrainingMode ? "combi" : "find";
        if (isCompetitiveMode) {
            isKidsMode = false;
            isTrainingMode = false;
        }
        deal = null;
        officialDeal = false;
        stopTrainingTimer();
        hintLevel = 0;
        paintAuth();
        showGameView("play");
        requestDeal();
    }

    private void maybeOpenWelcomeCompetition() {
        if (tab != 1 || !welcomeCompetition) return;
        boolean playOn = gamePlay != null && gamePlay.getVisibility() == View.VISIBLE;
        boolean studyOn = gameStudy != null && gameStudy.getVisibility() == View.VISIBLE;
        if (playOn || studyOn) {
            welcomeCompetition = false;
            return;
        }
        openWelcomeCompetition();
    }

    private void openWelcomeCompetition() {
        welcomeCompetition = false;
        pickGame("competitive");
    }

    private void bindAuth() {
        authStatus = findViewById(R.id.auth_status);
        authGoogle = findViewById(R.id.auth_google);
        authLogout = findViewById(R.id.auth_logout);
        gameMode = findViewById(R.id.game_mode);
        gameTraining = findViewById(R.id.game_training);
        gameKids = findViewById(R.id.game_kids);
        gameHint = findViewById(R.id.game_hint);
        trainingTools = findViewById(R.id.training_tools);
        trainingPresetBtn = findViewById(R.id.training_preset_btn);
        trainingMinBtn = findViewById(R.id.training_min_btn);
        trainingProgress = findViewById(R.id.training_progress);
        trainingTimerView = findViewById(R.id.training_timer);
        trainingReveal = findViewById(R.id.training_reveal);
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
        histOpen = findViewById(R.id.hist_open);
        if (histOpen != null) histOpen.setOnClickListener(v -> showHistoryDialog());
        TextView favOpen = findViewById(R.id.fav_open);
        if (favOpen != null) favOpen.setOnClickListener(v -> showFavoritesDialog());
        if (gameMode != null) gameMode.setOnClickListener(v -> {
            if (!isCompetitiveMode && !competitiveMode.loggedIn()) {
                competitiveMode.signIn(() -> {
                    isCompetitiveMode = true;
                    isKidsMode = false;
                    isTrainingMode = false;
                    deal = null;
                    paintAuth();
                    syncHistory();
                    showTab(1);
                });
                return;
            }
            isCompetitiveMode = !isCompetitiveMode;
            if (isCompetitiveMode) {
                isKidsMode = false;
                isTrainingMode = false;
            }
            gameKind = isCompetitiveMode ? "bingo" : "find";
            deal = null;
            paintAuth();
            showTab(1);
        });
        if (gameTraining != null) gameTraining.setOnClickListener(v -> {
            isTrainingMode = !isTrainingMode;
            if (isTrainingMode) {
                isKidsMode = false;
                isCompetitiveMode = false;
            }
            gameKind = isTrainingMode ? "combi" : "find";
            deal = null;
            stopTrainingTimer();
            paintAuth();
            showTab(1);
        });
        if (gameKids != null) gameKids.setOnClickListener(v -> {
            isKidsMode = !isKidsMode;
            if (isKidsMode) {
                isCompetitiveMode = false;
                isTrainingMode = false;
            }
            gameKind = "find";
            deal = null;
            hintLevel = 0;
            paintAuth();
            showTab(1);
        });
        if (gameHint != null) gameHint.setOnClickListener(v -> giveKidsHint());
        bindTrainingControls();
    }

    private void giveKidsHint() {
        if (deal == null || !isKidsMode || closed) return;
        String target = deal.seed;
        if (target == null || target.isEmpty()) {
            target = deal.catalog.isEmpty() ? "" : deal.catalog.get(0).word;
        }
        if (target.isEmpty()) return;
        hintLevel = Math.min(2, hintLevel + 1);
        gameLive.setVisibility(View.VISIBLE);
        if (hintLevel == 1) gameLive.setText(getString(R.string.kids_hint_letter, target.substring(0, 1)));
        else {
            gameLive.setText(getString(R.string.kids_hint_word, target));
            gameHint.setEnabled(false);
        }
        gameLive.setTextColor(getColor(R.color.ok));
    }

    private void bindTrainingControls() {
        trainingPreset = getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                .getString("training-preset", "all");
        if (!java.util.Arrays.asList("all", "seven", "eight", "plusOne", "joker", "hard")
                .contains(trainingPreset)) trainingPreset = "all";
        trainingMinLen = getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                .getInt("training-min", 5);
        if (trainingMinLen < 2 || trainingMinLen > 7) trainingMinLen = 5;
        if (trainingPresetBtn != null) trainingPresetBtn.setOnClickListener(v -> pickTrainingPreset());
        if (trainingMinBtn != null) {
            trainingMinBtn.setOnClickListener(v -> {
                // Discreet cycle 2+ → … → 7 : the chip stays tiny, no dialog.
                trainingMinLen = trainingMinLen >= 7 ? 2 : trainingMinLen + 1;
                getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                        .edit().putInt("training-min", trainingMinLen).apply();
                paintTrainingSelectors();
                if (isTrainingMode && lex != null) startDeal(lex.training(trainingPreset, trainingMinLen));
            });
        }
        paintTrainingSelectors();
        if (trainingTimerView != null) {
            trainingTimerView.setOnClickListener(v -> {
                if (trainingTimerSeconds == 0) trainingTimerSeconds = 30;
                else if (trainingTimerSeconds == 30) trainingTimerSeconds = 60;
                else if (trainingTimerSeconds == 60) trainingTimerSeconds = 120;
                else trainingTimerSeconds = 0;
                paintTrainingTimer();
                if (isTrainingMode && deal != null && !closed) startTrainingTimer();
            });
        }
        if (trainingReveal != null) trainingReveal.setOnClickListener(v -> finishTraining(false));
        paintTrainingTimer();
        paintTrainingProgress();
    }

    private static final String[] TRAINING_KEYS = {"all", "seven", "eight", "plusOne", "joker", "hard"};
    private static final int[] TRAINING_LABELS = {
            R.string.training_all, R.string.training_seven, R.string.training_eight,
            R.string.training_plus_one, R.string.training_joker, R.string.training_hard
    };

    private int trainingPresetIndex() {
        for (int i = 0; i < TRAINING_KEYS.length; i++) {
            if (TRAINING_KEYS[i].equals(trainingPreset)) return i;
        }
        return 0;
    }

    /** One dropdown for the mode instead of the old chip row. */
    private void pickTrainingPreset() {
        String[] items = new String[TRAINING_LABELS.length];
        for (int i = 0; i < TRAINING_LABELS.length; i++) items[i] = getString(TRAINING_LABELS[i]);
        new AlertDialog.Builder(this)
                .setTitle(R.string.menu_training)
                .setSingleChoiceItems(items, trainingPresetIndex(), (dialog, which) -> {
                    dialog.dismiss();
                    if (TRAINING_KEYS[which].equals(trainingPreset)) return;
                    trainingPreset = TRAINING_KEYS[which];
                    getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                            .edit().putString("training-preset", trainingPreset).apply();
                    paintTrainingSelectors();
                    if (isTrainingMode && lex != null) startDeal(lex.training(trainingPreset, trainingMinLen));
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private void paintTrainingSelectors() {
        if (trainingPresetBtn != null) {
            trainingPresetBtn.setText(getString(TRAINING_LABELS[trainingPresetIndex()]) + "  ▾");
        }
        if (trainingMinBtn != null) {
            // The min-length filter only means something on the free "all" mode.
            boolean on = "all".equals(trainingPreset);
            trainingMinBtn.setVisibility(on ? View.VISIBLE : View.GONE);
            trainingMinBtn.setText(trainingMinLen >= 7 ? "7" : trainingMinLen + "+");
            trainingMinBtn.setContentDescription(getString(R.string.training_min_cd, trainingMinLen));
        }
    }

    private void paintTrainingTimer() {
        if (trainingTimerView == null) return;
        trainingTimerView.setText(trainingTimerSeconds == 0
                ? getString(R.string.training_no_timer)
                : trainingTimerSeconds < 60 ? trainingTimerSeconds + " s"
                : (trainingTimerSeconds / 60) + " min");
    }

    private void stopTrainingTimer() {
        trainingHandler.removeCallbacksAndMessages(null);
        trainingEndsAt = 0;
    }

    private void startTrainingTimer() {
        stopTrainingTimer();
        if (!isTrainingMode || trainingTimerSeconds <= 0 || deal == null || closed) {
            paintTrainingProgress();
            return;
        }
        trainingEndsAt = SystemClock.elapsedRealtime() + trainingTimerSeconds * 1000L;
        trainingHandler.post(new Runnable() {
            @Override
            public void run() {
                if (!isTrainingMode || closed || trainingEndsAt == 0) return;
                if (SystemClock.elapsedRealtime() >= trainingEndsAt) {
                    finishTraining(false);
                    return;
                }
                paintTrainingProgress();
                trainingHandler.postDelayed(this, 250);
            }
        });
    }

    private void paintTrainingProgress() {
        if (trainingProgress == null) return;
        int total = trainingNeeded.size();
        String timer = "";
        if (trainingEndsAt > 0) {
            long seconds = Math.max(0, (trainingEndsAt - SystemClock.elapsedRealtime() + 999) / 1000);
            timer = " · " + seconds + "s";
        }
        trainingProgress.setText(getString(R.string.training_progress, trainingNeededFound(), total, timer));
    }

    private void paintTrainingStats() {
        if (gameAvg == null) return;
        String suffix = "-" + Lang.get(this);
        android.content.SharedPreferences prefs = getSharedPreferences("verimots-training", MODE_PRIVATE);
        gameAvg.setText(getString(R.string.training_stats,
                prefs.getInt("solved" + suffix, 0), prefs.getInt("plays" + suffix, 0)));
    }

    private void paintGameAverage() {
        if (gameAvg == null || isKidsMode) return;
        if (isTrainingMode) paintTrainingStats();
        else gameAvg.setText(fmtAvg(publicAverageHas, publicAverage));
    }

    private void recordTraining(boolean solved) {
        if (trainingRecorded) return;
        trainingRecorded = true;
        String suffix = "-" + Lang.get(this);
        android.content.SharedPreferences prefs = getSharedPreferences("verimots-training", MODE_PRIVATE);
        prefs.edit()
                .putInt("plays" + suffix, prefs.getInt("plays" + suffix, 0) + 1)
                .putInt("solved" + suffix, prefs.getInt("solved" + suffix, 0) + (solved ? 1 : 0))
                .apply();
        paintTrainingStats();
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
        if (gameKids != null) {
            gameKids.setText(isKidsMode ? R.string.kids_cat : R.string.mode_kids);
        }
        if (gameTraining != null) {
            gameTraining.setText(isTrainingMode ? R.string.training_on : R.string.training);
        }
        if (trainingTools != null) trainingTools.setVisibility(isTrainingMode ? View.VISIBLE : View.GONE);
        if (gameAvg != null) {
            gameAvg.setVisibility(isTrainingMode ? View.VISIBLE : View.GONE);
            if (isTrainingMode) paintTrainingStats();
        }
        paintHistory();
    }

    private void styleBoardTabs() {
        if (boardTabGeneral != null) {
            boolean on = !boardKidsTab;
            boardTabGeneral.setBackgroundResource(on ? R.drawable.bg_gold_btn : R.drawable.bg_pill);
            boardTabGeneral.setTextColor(getColor(on ? R.color.tile_ink : R.color.ink));
        }
        if (boardTabKids != null) {
            boolean on = boardKidsTab;
            boardTabKids.setBackgroundResource(on ? R.drawable.bg_gold_btn : R.drawable.bg_pill);
            boardTabKids.setTextColor(getColor(on ? R.color.tile_ink : R.color.ink));
        }
        paintChart();
    }

    private void bindFeedback() {
        View fab = findViewById(R.id.feedback_fab);
        if (fab != null) fab.setOnClickListener(v -> showFeedbackDialog());
        View aboutFeedback = findViewById(R.id.about_feedback);
        if (aboutFeedback != null) aboutFeedback.setOnClickListener(v -> showFeedbackDialog());
    }

    private void showFeedbackDialog() {
        View view = getLayoutInflater().inflate(R.layout.dialog_feedback, null);
        EditText msg = view.findViewById(R.id.feedback_msg);
        EditText email = view.findViewById(R.id.feedback_email);
        TextView status = view.findViewById(R.id.feedback_status);
        TextView send = view.findViewById(R.id.feedback_send);
        TextView close = view.findViewById(R.id.feedback_close);
        Dialog dialog = new Dialog(this);
        dialog.setContentView(view);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(R.color.felt_card);
            int width = Math.round(getResources().getDisplayMetrics().widthPixels * 0.92f);
            dialog.getWindow().setLayout(width, android.view.ViewGroup.LayoutParams.WRAP_CONTENT);
        }
        if (close != null) close.setOnClickListener(v -> dialog.dismiss());
        if (send != null) send.setOnClickListener(v -> {
            String text = msg == null ? "" : msg.getText().toString().trim();
            if (text.length() < 4) {
                if (status != null) {
                    status.setVisibility(View.VISIBLE);
                    status.setTextColor(getColor(R.color.no));
                    status.setText(R.string.feedback_need);
                }
                return;
            }
            send.setEnabled(false);
            RemoteApi.sendFeedback(text, email == null ? "" : email.getText().toString().trim(), Lang.get(this), new RemoteApi.FeedbackCb() {
                @Override
                public void ok() {
                    Toast.makeText(MainActivity.this, R.string.feedback_ok, Toast.LENGTH_SHORT).show();
                    dialog.dismiss();
                }

                @Override
                public void error(String message) {
                    send.setEnabled(true);
                    if (status != null) {
                        status.setVisibility(View.VISIBLE);
                        status.setTextColor(getColor(R.color.no));
                        status.setText(R.string.feedback_err);
                    }
                }
            });
        });
        dialog.show();
        if (msg != null) msg.requestFocus();
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
        Switch alphaToggle = findViewById(R.id.alpha_toggle);
        if (alphaToggle != null) {
            alphaToggle.setChecked(alphaBtnOn);
            alphaToggle.setOnCheckedChangeListener((CompoundButton button, boolean checked) -> {
                alphaBtnOn = checked;
                getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                        .edit().putBoolean("alpha-btn", checked).apply();
                if (!checked && rackAlpha) {
                    rackAlpha = false;
                    getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                            .edit().putBoolean("rack-alpha", false).apply();
                    if (deal != null) paintRack();
                }
                paintAlphaBtn();
            });
        }
        paintModes();
    }

    private void bindStudy() {
        aboutDict = findViewById(R.id.about_dict);
        if (aboutDict != null) aboutDict.setOnClickListener(v -> exportLexicon());
        gameStudyBody = findViewById(R.id.game_study_body);
        TextView gameStudyShare = findViewById(R.id.game_study_share);
        TextView gameStudyTwos = findViewById(R.id.game_study_twos);
        if (gameStudyShare != null) gameStudyShare.setOnClickListener(v -> shareDailyStudy());
        if (gameStudyTwos != null) gameStudyTwos.setOnClickListener(v -> shareTodayTwos());
        if (studyFav != null) studyFav.setOnClickListener(v -> {
            if (studyDefShown.isEmpty() || lex == null) return;
            FavStore.toggle(this, studyDefShown, lex.score(studyDefShown, null));
            paintFavStar(studyFav, studyDefShown);
        });
        paintStudy();
    }

    private String studyDate() {
        Calendar cal = Calendar.getInstance();
        int d = cal.get(Calendar.DAY_OF_MONTH);
        int m = cal.get(Calendar.MONTH) + 1;
        int y = cal.get(Calendar.YEAR);
        return String.format(java.util.Locale.US, "%02d/%02d/%d", d, m, y);
    }

    private void paintStudy() {
        if (gameStudyBody == null && findViewById(R.id.game_study_twos_words) == null) return;
        if (lex == null) {
            if (gameStudyBody != null) gameStudyBody.setText(R.string.loading);
            return;
        }
        Calendar cal = Calendar.getInstance();
        List<String> twos = Lexicon.dailyStudySlice(
                lex.wordsOfLength(2),
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH),
                cal.get(Calendar.DAY_OF_MONTH),
                10);
        List<String> threes = Lexicon.dailyStudySlice(
                lex.wordsOfLength(3),
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH),
                cal.get(Calendar.DAY_OF_MONTH),
                12);
        String pack = getString(
                R.string.study_pack,
                getString(R.string.study_today, studyDate()),
                Lexicon.joinWords(twos),
                Lexicon.joinWords(threes));
        if (gameStudyBody != null) gameStudyBody.setText(pack);
        TextView when = findViewById(R.id.game_study_when);
        if (when != null) when.setText(getString(R.string.study_today, studyDate()));
        TextView twosLabel = findViewById(R.id.game_study_twos_label);
        TextView threesLabel = findViewById(R.id.game_study_threes_label);
        if (twosLabel != null) twosLabel.setText(getString(R.string.study_section, getString(R.string.study_twos), twos.size()));
        if (threesLabel != null) threesLabel.setText(getString(R.string.study_section, getString(R.string.study_threes), threes.size()));
        fillStudyWords(findViewById(R.id.game_study_twos_words), twos);
        fillStudyWords(findViewById(R.id.game_study_threes_words), threes);
        if (studyDefPanel != null) studyDefPanel.setVisibility(View.GONE);
        studyDefWord = "";
        studyDefShown = "";
    }

    private void fillStudyWords(android.view.ViewGroup row, List<String> words) {
        if (row == null) return;
        row.removeAllViews();
        for (String word : words) {
            TextView tile = Tiles.studyTile(this, word);
            tile.setOnClickListener(v -> showStudyDefinition(word));
            row.addView(tile);
        }
    }

    private void showStudyDefinition(String word) {
        if (studyDefPanel == null) return;
        if (word.equals(studyDefWord) && studyDefPanel.getVisibility() == View.VISIBLE) {
            studyDefPanel.setVisibility(View.GONE);
            studyDefWord = "";
            studyDefShown = "";
            return;
        }
        studyDefWord = word;
        studyDefPanel.setVisibility(View.VISIBLE);
        navigateStudyDef(word, word);
        // The panel lives at the bottom of the card — bring it into view so a
        // tap on a word visibly answers below.
        View sv = findViewById(R.id.game_study);
        if (sv instanceof ScrollView) {
            sv.post(() -> ((ScrollView) sv).requestChildFocus(studyDefPanel, studyDefPanel));
        }
    }

    // Same presentation and in-place navigation as the game result panel:
    // word · pos header, tappable root/gloss words, back chip to the word
    // that opened the panel.
    private void navigateStudyDef(String root, String home) {
        final int seq = ++studyDefSeq;
        studyDefShown = Lexicon.normalize(root);
        if (studyDefHead != null) studyDefHead.setText(defHeader(root, ""));
        paintFavStar(studyFav, studyDefShown);
        if (studyDefBody != null) {
            studyDefBody.setText(R.string.def_pending);
            studyDefBody.setMovementMethod(null);
        }
        if (studyDefLemma != null) studyDefLemma.setVisibility(View.GONE);
        RemoteApi.define(root, new RemoteApi.DefCb() {
            @Override
            public void ok(String pos, String text, String url, String lemma) {
                if (seq != studyDefSeq || studyDefWord.isEmpty()) return;
                if (studyDefHead != null) studyDefHead.setText(defHeader(root, pos));
                paintStudyDefBody(text, lemma, root, home);
            }

            @Override
            public void empty(String message) {
                if (seq != studyDefSeq || studyDefWord.isEmpty()) return;
                if (studyDefHead != null) studyDefHead.setText(defHeader(root, ""));
                if (studyDefBody != null) studyDefBody.setText(defMessage(message));
                if (studyDefLemma != null && home != null
                        && !Lexicon.normalize(root).equals(Lexicon.normalize(home))) {
                    studyDefLemma.setVisibility(View.VISIBLE);
                    studyDefLemma.setText("‹ " + home);
                    studyDefLemma.setOnClickListener(v -> navigateStudyDef(home, home));
                }
            }
        }, Lang.get(this));
    }

    private void paintStudyDefBody(String text, String apiLemma, String current, String home) {
        if (studyDefBody == null) return;
        String extracted = Defs.extractFormOf(text);
        if (extracted.isEmpty() && apiLemma != null && !apiLemma.isEmpty()) {
            String folded = Lexicon.normalize(apiLemma);
            if (!folded.isEmpty() && current != null && !folded.equals(Lexicon.normalize(current))) extracted = apiLemma;
        }
        final String form = extracted;
        boolean away = home != null && current != null
                && !Lexicon.normalize(current).equals(Lexicon.normalize(home));
        if (form.isEmpty()) {
            paintLinkedDef(studyDefBody, text, w -> navigateStudyDef(w, home));
        } else {
            SpannableString span = new SpannableString(text);
            String hay = text.toLowerCase(java.util.Locale.FRENCH);
            int at = hay.lastIndexOf(form.toLowerCase(java.util.Locale.FRENCH));
            if (at >= 0) {
                span.setSpan(
                        new ClickableSpan() {
                            @Override
                            public void onClick(View widget) {
                                navigateStudyDef(form, home);
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
            studyDefBody.setText(span);
            studyDefBody.setMovementMethod(LinkMovementMethod.getInstance());
            studyDefBody.setHighlightColor(getColor(R.color.gold_soft));
        }
        if (studyDefLemma == null) return;
        if (away) {
            studyDefLemma.setVisibility(View.VISIBLE);
            studyDefLemma.setText("‹ " + home);
            studyDefLemma.setOnClickListener(v -> navigateStudyDef(home, home));
        } else if (!form.isEmpty()) {
            studyDefLemma.setVisibility(View.VISIBLE);
            studyDefLemma.setText(getString(R.string.see_lemma, form));
            studyDefLemma.setOnClickListener(v -> navigateStudyDef(form, home));
        } else {
            studyDefLemma.setVisibility(View.GONE);
        }
    }

    private void shareDailyStudy() {
        if (lex == null) return;
        Calendar cal = Calendar.getInstance();
        List<String> twos = Lexicon.dailyStudySlice(
                lex.wordsOfLength(2),
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH),
                cal.get(Calendar.DAY_OF_MONTH),
                10);
        List<String> threes = Lexicon.dailyStudySlice(
                lex.wordsOfLength(3),
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH),
                cal.get(Calendar.DAY_OF_MONTH),
                12);
        share(getString(
                R.string.share_study_daily,
                studyDate()) + "\n\n" + getString(
                R.string.study_pack,
                "",
                Lexicon.joinWords(twos),
                Lexicon.joinWords(threes)).trim() + "\n");
    }

    private void shareTodayTwos() {
        if (lex == null) return;
        Calendar cal = Calendar.getInstance();
        List<String> twos = Lexicon.dailyStudySlice(
                lex.wordsOfLength(2),
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH),
                cal.get(Calendar.DAY_OF_MONTH),
                10);
        share(getString(R.string.share_study_list, 2, twos.size(), Lexicon.joinWords(twos)));
    }

    private void shareTwoLetterList() {
        if (lex == null) return;
        List<String> twos = lex.wordsOfLength(2);
        share(getString(R.string.share_study_list, 2, twos.size(), Lexicon.joinWords(twos)));
    }

    private void exportLexicon() {
        if (lex == null) {
            Toast.makeText(this, R.string.lex_unavailable, Toast.LENGTH_SHORT).show();
            return;
        }
        if (aboutDict != null) {
            aboutDict.setEnabled(false);
            aboutDict.setText(R.string.dict_downloading);
        }
        new Thread(() -> {
            try {
                File out = new File(getCacheDir(), Lexicon.exportFileName(Dict.get(this)));
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    fos.write(lex.exportText().getBytes(StandardCharsets.UTF_8));
                }
                Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", out);
                runOnUiThread(() -> {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(i, getString(R.string.dict_download)));
                    if (aboutDict != null) {
                        aboutDict.setEnabled(true);
                        aboutDict.setText(R.string.dict_download);
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, R.string.dict_download_err, Toast.LENGTH_SHORT).show();
                    if (aboutDict != null) {
                        aboutDict.setEnabled(true);
                        aboutDict.setText(R.string.dict_download);
                    }
                });
            }
        }).start();
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
            sum.setText(getString(R.string.playable_count, total, total > 1 ? "s" : ""));
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
            TextView chip = Tiles.resultChip(this, hit, lex.score(hit, null), null);
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
        if (lemma != null && lemma.matches(".*[-'’].*")) {
            String lang = Lang.get(this);
            boolean onGame = tab == 1;
            RemoteApi.define(lemma, new RemoteApi.DefCb() {
                @Override
                public void ok(String pos, String text, String url, String foundLemma) {
                    if (onGame) {
                        gamePos.setText(defHeader(lemma, pos));
                        setGameDefWord(lemma);
                        paintGameDef(text, foundLemma, lemma, lemma);
                    } else {
                        checkPos.setText(pos);
                        paintDef(checkDef, checkLemma, text, foundLemma, lemma);
                    }
                }

                @Override
                public void empty(String message) {
                    if (onGame) {
                        gamePos.setText(defHeader(lemma, ""));
                        gameDef.setText(defMessage(message));
                    } else {
                        checkPos.setText("");
                        checkDef.setText(defMessage(message));
                    }
                }
            }, lang);
            return;
        }
        String word = Lexicon.normalize(lemma);
        if (word.length() < 2) return;
        showTab(0);
        openExact(word);
    }

    private interface WordTap { void tap(String word); }

    private static final java.util.Set<String> DEF_STOP = new java.util.HashSet<>(java.util.Arrays.asList(
            "ainsi", "alors", "apres", "aussi", "autre", "autres", "avant", "avec", "avoir",
            "chez", "comme", "contre", "dans", "depuis", "des", "donc", "dont", "entre",
            "est", "etre", "fait", "faire", "les", "lors", "mais", "meme", "moins", "ont",
            "parmi", "pas", "pendant", "plus", "pour", "quand", "que", "qui", "sans",
            "selon", "sont", "sous", "sur", "tout", "toute", "toutes", "tous", "tres",
            "une", "vers"));

    private static final Pattern DEF_WORD =
            Pattern.compile("[A-Za-z\u00c0-\u00ff\u0152\u0153][A-Za-z\u00c0-\u00ff\u0152\u0153'\u2019-]*");

    // Web parity: with no inflection root, every plain word of the gloss
    // (>= 4 letters, not a stopword) is tappable.
    private void paintLinkedDef(TextView def, String text, WordTap onWord) {
        if (def == null) return;
        if (text == null || text.isEmpty()) {
            def.setText("");
            def.setMovementMethod(null);
            return;
        }
        SpannableString span = new SpannableString(text);
        java.util.regex.Matcher m = DEF_WORD.matcher(text);
        int linked = 0;
        while (m.find()) {
            final String word = m.group();
            String folded = Lexicon.normalize(word);
            if (folded.length() < 4 || DEF_STOP.contains(folded.toLowerCase(java.util.Locale.ROOT))) continue;
            span.setSpan(
                    new ClickableSpan() {
                        @Override
                        public void onClick(View widget) {
                            onWord.tap(word);
                        }

                        @Override
                        public void updateDrawState(TextPaint ds) {
                            ds.setColor(getColor(R.color.ink));
                            ds.setUnderlineText(true);
                        }
                    },
                    m.start(),
                    m.end(),
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            linked++;
        }
        def.setText(span);
        def.setMovementMethod(linked > 0 ? LinkMovementMethod.getInstance() : null);
        def.setHighlightColor(getColor(R.color.gold_soft));
    }

    // In-place definition navigation on the game result: tapping the root of
    // an inflection swaps the panel to that word's sense (the old behavior
    // yanked the user to the Vérifier tab), and a back chip returns to the
    // played word.
    private void paintGameDef(String text, String apiLemma, String current, String home) {
        if (gameDef == null) return;
        String extracted = Defs.extractFormOf(text);
        if (extracted.isEmpty() && apiLemma != null && !apiLemma.isEmpty()) {
            String folded = Lexicon.normalize(apiLemma);
            if (!folded.isEmpty() && current != null && !folded.equals(Lexicon.normalize(current))) extracted = apiLemma;
        }
        final String form = extracted;
        boolean away = home != null && current != null && !Lexicon.normalize(current).equals(Lexicon.normalize(home));
        if (form.isEmpty()) {
            paintLinkedDef(gameDef, text, word -> navigateGameDef(word, home));
        } else {
            SpannableString span = new SpannableString(text);
            String hay = text.toLowerCase(java.util.Locale.FRENCH);
            int at = hay.lastIndexOf(form.toLowerCase(java.util.Locale.FRENCH));
            if (at >= 0) {
                span.setSpan(
                        new ClickableSpan() {
                            @Override
                            public void onClick(View widget) {
                                navigateGameDef(form, home);
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
            gameDef.setText(span);
            gameDef.setMovementMethod(LinkMovementMethod.getInstance());
            gameDef.setHighlightColor(getColor(R.color.gold_soft));
        }
        if (gameLemma == null) return;
        if (away) {
            gameLemma.setVisibility(View.VISIBLE);
            gameLemma.setText("\u2039 " + home);
            gameLemma.setOnClickListener(v -> showDef(home));
        } else if (!form.isEmpty()) {
            gameLemma.setVisibility(View.VISIBLE);
            gameLemma.setText(getString(R.string.see_lemma, form));
            gameLemma.setOnClickListener(v -> navigateGameDef(form, home));
        } else {
            gameLemma.setVisibility(View.GONE);
        }
    }

    private void navigateGameDef(String root, String home) {
        final int seq = ++defSeq;
        gamePos.setText(defHeader(root, ""));
        setGameDefWord(root);
        gameDef.setText(R.string.def_pending);
        gameDef.setMovementMethod(null);
        RemoteApi.define(root, new RemoteApi.DefCb() {
            @Override
            public void ok(String pos, String text, String url, String lemma) {
                if (seq != defSeq) return;
                gamePos.setText(defHeader(root, pos));
                paintGameDef(text, lemma, root, home);
            }

            @Override
            public void empty(String message) {
                if (seq != defSeq) return;
                gamePos.setText(defHeader(root, ""));
                gameDef.setText(defMessage(message));
                if (gameLemma != null && home != null) {
                    gameLemma.setVisibility(View.VISIBLE);
                    gameLemma.setText("\u2039 " + home);
                    gameLemma.setOnClickListener(v -> showDef(home));
                }
            }
        }, Lang.get(this));
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
            paintLinkedDef(def, text, word -> {
                String folded = Lexicon.normalize(word);
                if (folded.length() >= 2) openExact(folded);
            });
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
        if (historyDialog != null && historyDialog.isShowing() && historyList != null) {
            fillHistoryList(historyList, historyDialog.findViewById(R.id.hist_clear));
        }
    }

    private void showHistoryDialog() {
        View view = getLayoutInflater().inflate(R.layout.dialog_history, null);
        TextView title = view.findViewById(R.id.hist_dialog_title);
        TextView sub = view.findViewById(R.id.hist_dialog_sub);
        TextView close = view.findViewById(R.id.hist_dialog_close);
        TextView clear = view.findViewById(R.id.hist_clear);
        historyList = view.findViewById(R.id.hist_list);
        if (title != null) title.setText(R.string.hist_local);
        if (sub != null) {
            boolean on = competitiveMode.loggedIn();
            sub.setVisibility(on ? View.VISIBLE : View.GONE);
            if (on) sub.setText(R.string.hist_signed);
            else sub.setText("");
        }
        fillHistoryList(historyList, clear);
        historyDialog = new Dialog(this);
        historyDialog.setContentView(view);
        if (historyDialog.getWindow() != null) {
            historyDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            int width = Math.round(getResources().getDisplayMetrics().widthPixels * 0.92f);
            int height = Math.round(getResources().getDisplayMetrics().heightPixels * 0.76f);
            historyDialog.getWindow().setLayout(width, height);
        }
        if (close != null) close.setOnClickListener(v -> historyDialog.dismiss());
        if (clear != null) clear.setOnClickListener(v -> confirmClearHistory());
        historyDialog.show();
    }

    private void fillHistoryList(LinearLayout list, TextView clear) {
        if (list == null) return;
        list.removeAllViews();
        List<HistoryStore.Row> rows = HistoryStore.load(this);
        if (clear != null) clear.setVisibility(rows.isEmpty() ? View.GONE : View.VISIBLE);
        if (rows.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText(R.string.hist_empty);
            empty.setTextColor(getColor(R.color.muted));
            empty.setGravity(android.view.Gravity.CENTER);
            empty.setPadding(16, 48, 16, 32);
            empty.setTextSize(15);
            list.addView(empty);
            return;
        }
        String lastDay = "";
        for (HistoryStore.Row row : rows) {
            String day = historyDayLabel(row.at);
            if (!day.isEmpty() && !day.equals(lastDay)) {
                lastDay = day;
                TextView head = new TextView(this);
                head.setText(day);
                head.setAllCaps(true);
                head.setTextColor(getColor(R.color.dim));
                head.setTextSize(11);
                head.setLetterSpacing(0.08f);
                head.setPadding(8, 12, 8, 8);
                list.addView(head);
            }
            View line = getLayoutInflater().inflate(R.layout.hist_row, list, false);
            TextView word = line.findViewById(R.id.hist_row_word);
            TextView pts = line.findViewById(R.id.hist_row_pts);
            TextView meta = line.findViewById(R.id.hist_row_meta);
            if (word != null) word.setText(row.word);
            if (pts != null) pts.setText(String.valueOf(row.pts));
            if (meta != null) {
                meta.setText(getString("defi".equals(row.src) ? R.string.src_game : R.string.src_check));
            }
            TextView fav = line.findViewById(R.id.hist_row_fav);
            if (fav != null) {
                paintFavStar(fav, row.word);
                fav.setOnClickListener(v -> {
                    FavStore.toggle(this, row.word, row.pts);
                    paintFavStar(fav, row.word);
                });
            }
            line.setOnClickListener(v -> {
                if (historyDialog != null) historyDialog.dismiss();
                showTab(0);
                findMode = "exact";
                paintModes();
                checkQ.setText(row.word);
                checkQ.setSelection(row.word.length());
                doCheck(true);
            });
            list.addView(line);
        }
    }

    private void showFavoritesDialog() {
        View view = getLayoutInflater().inflate(R.layout.dialog_history, null);
        TextView title = view.findViewById(R.id.hist_dialog_title);
        TextView sub = view.findViewById(R.id.hist_dialog_sub);
        TextView close = view.findViewById(R.id.hist_dialog_close);
        TextView clear = view.findViewById(R.id.hist_clear);
        LinearLayout list = view.findViewById(R.id.hist_list);
        if (title != null) title.setText(R.string.fav_title);
        if (sub != null) sub.setVisibility(View.GONE);
        if (clear != null) clear.setVisibility(View.GONE);
        favoritesDialog = new Dialog(this);
        fillFavoritesList(list);
        favoritesDialog.setContentView(view);
        if (favoritesDialog.getWindow() != null) {
            favoritesDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            int width = Math.round(getResources().getDisplayMetrics().widthPixels * 0.92f);
            int height = Math.round(getResources().getDisplayMetrics().heightPixels * 0.76f);
            favoritesDialog.getWindow().setLayout(width, height);
        }
        if (close != null) close.setOnClickListener(v -> favoritesDialog.dismiss());
        favoritesDialog.show();
    }

    private void fillFavoritesList(LinearLayout list) {
        if (list == null) return;
        list.removeAllViews();
        List<FavStore.Row> rows = FavStore.load(this);
        if (rows.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText(R.string.fav_empty);
            empty.setTextColor(getColor(R.color.muted));
            empty.setGravity(android.view.Gravity.CENTER);
            empty.setPadding(16, 48, 16, 32);
            empty.setTextSize(15);
            list.addView(empty);
            return;
        }
        for (FavStore.Row row : rows) {
            View line = getLayoutInflater().inflate(R.layout.hist_row, list, false);
            TextView word = line.findViewById(R.id.hist_row_word);
            TextView pts = line.findViewById(R.id.hist_row_pts);
            TextView meta = line.findViewById(R.id.hist_row_meta);
            TextView fav = line.findViewById(R.id.hist_row_fav);
            if (word != null) word.setText(row.word);
            if (pts != null) pts.setText(String.valueOf(row.pts));
            if (meta != null) meta.setVisibility(View.GONE);
            if (fav != null) {
                paintFavStar(fav, row.word);
                // Toggle in place — the row survives so an accidental tap can
                // be undone without reopening the dialog.
                fav.setOnClickListener(v -> {
                    FavStore.toggle(this, row.word, row.pts);
                    paintFavStar(fav, row.word);
                });
            }
            line.setOnClickListener(v -> {
                if (favoritesDialog != null) favoritesDialog.dismiss();
                showTab(0);
                findMode = "exact";
                paintModes();
                checkQ.setText(row.word);
                checkQ.setSelection(row.word.length());
                doCheck(true);
            });
            list.addView(line);
        }
    }

    private String historyDayLabel(long at) {
        if (at <= 0) return "";
        Calendar then = Calendar.getInstance();
        then.setTimeInMillis(at);
        Calendar now = Calendar.getInstance();
        if (sameDay(then, now)) return getString(R.string.hist_today);
        now.add(Calendar.DAY_OF_YEAR, -1);
        if (sameDay(then, now)) return getString(R.string.hist_yesterday);
        return DateFormat.getMediumDateFormat(this).format(new Date(at));
    }

    private static boolean sameDay(Calendar a, Calendar b) {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR)
                && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR);
    }

    private void confirmClearHistory() {
        new AlertDialog.Builder(this)
                .setMessage(R.string.hist_clear_confirm)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(android.R.string.ok, (d, w) -> {
                    HistoryStore.clear(this);
                    if (competitiveMode.loggedIn()) {
                        RemoteApi.clearHistory(new RemoteApi.HistoryCb() {
                            @Override
                            public void ok(org.json.JSONArray history, org.json.JSONObject stats) {
                                paintHistory();
                            }

                            @Override
                            public void error(String message) {
                                paintHistory();
                            }
                        });
                    }
                    paintHistory();
                })
                .show();
    }

    private void bindGame() {
        gameRack = findViewById(R.id.game_rack);
        gameForm = findViewById(R.id.game_form);
        gameQ = findViewById(R.id.game_q);
        gameLive = findViewById(R.id.game_live);
        gameCat = findViewById(R.id.game_cat);
        gameAvg = findViewById(R.id.game_avg);
        gameResult = findViewById(R.id.game_result);
        gameAgain = findViewById(R.id.game_again);
        gamePct = findViewById(R.id.game_pct);
        gameBreak = findViewById(R.id.game_break);
        gameVs = findViewById(R.id.game_vs);
        gameTop = findViewById(R.id.game_top);
        gamePos = findViewById(R.id.game_pos);
        gameDef = findViewById(R.id.game_def);
        gameLemma = findViewById(R.id.game_lemma);
        gameWa = findViewById(R.id.game_wa);
        gameChart = findViewById(R.id.game_chart);
        gameChartAvg = findViewById(R.id.game_chart_avg);
        gameChartAvgUnit = findViewById(R.id.game_chart_avg_unit);
        gameLast = findViewById(R.id.game_last);
        gameLastUnit = findViewById(R.id.game_last_unit);
        boardChartAvg = findViewById(R.id.board_chart_avg);
        boardChartAvgUnit = findViewById(R.id.board_chart_avg_unit);
        boardChart = findViewById(R.id.board_chart);
        boardChartLast = findViewById(R.id.board_chart_last);
        gameSpacer = findViewById(R.id.game_spacer);
        gameDock = findViewById(R.id.game_dock);
        gameClear = findViewById(R.id.game_clear);
        gameSkip = findViewById(R.id.game_skip);
        gameFav = findViewById(R.id.game_fav);
        gameAlpha = findViewById(R.id.game_alpha);
        gameRackTools = findViewById(R.id.game_rack_tools);
        rackAlpha = getSharedPreferences("verimots-prefs", MODE_PRIVATE).getBoolean("rack-alpha", false);
        alphaBtnOn = getSharedPreferences("verimots-prefs", MODE_PRIVATE).getBoolean("alpha-btn", false);
        View.OnClickListener clearPlay = v -> {
            gameQ.setText("");
            gameQ.requestFocus();
        };
        if (gameClear != null) gameClear.setOnClickListener(clearPlay);
        if (gameSkip != null) gameSkip.setOnClickListener(v -> skipPlay());
        if (gameFav != null) gameFav.setOnClickListener(v -> {
            if (gameDefWord.isEmpty() || lex == null) return;
            FavStore.toggle(this, gameDefWord, lex.score(gameDefWord, null));
            paintFavStar(gameFav, gameDefWord);
        });
        if (gameAlpha != null) {
            paintAlphaBtn();
            gameAlpha.setOnClickListener(v -> {
                rackAlpha = !rackAlpha;
                getSharedPreferences("verimots-prefs", MODE_PRIVATE)
                        .edit().putBoolean("rack-alpha", rackAlpha).apply();
                paintAlphaBtn();
                paintRack();
            });
        }
        findViewById(R.id.game_go).setOnClickListener(v -> submitPlay());
        View trainingInfo = findViewById(R.id.training_info);
        if (trainingInfo != null) {
            trainingInfo.setOnClickListener(v -> new android.app.AlertDialog.Builder(this)
                    .setTitle(R.string.training_rules_title)
                    .setMessage(R.string.training_rules_body)
                    .setPositiveButton(android.R.string.ok, null)
                    .show());
        }
        findViewById(R.id.game_again).setOnClickListener(v -> {
            if (lex == null) return;
            if (officialDeal && !pendingRankedWord.isEmpty() && competitiveMode.loggedIn()) {
                submitOfficialScore(pendingRankedPercent, pendingRankedWord, true);
                return;
            }
            officialDeal = competitiveMode.loggedIn() && (isKidsMode || isCompetitiveMode);
            startDeal(isKidsMode ? lex.kidsDeal() : isTrainingMode ? lex.training(trainingPreset, trainingMinLen) : lex.challenge());
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
        rankedSubmitGeneration++;
        rankedSubmitInFlight = false;
        pendingRankedPercent = -1;
        pendingRankedWord = "";
        deal = next;
        closed = false;
        pickedTiles.clear();
        showGameView("play");
        lastPlayedWord = "";
        lastPlayedPts = 0;
        lastPlayedDef = "";
        trainingFound.clear();
        trainingNeeded.clear();
        if (isTrainingMode && next.catalog != null) {
            for (Lexicon.Play play : next.catalog) trainingNeeded.add(play.word);
        }
        trainingRecorded = false;
        stopTrainingTimer();
        gameQ.setText("");
        gameQ.setEnabled(true);
        gameForm.setVisibility(View.VISIBLE);
        gameLive.setVisibility(View.VISIBLE);
        gameLive.setText("");
        gameResult.setVisibility(View.GONE);
        if (gameAgain != null) gameAgain.setVisibility(View.GONE);
        if (gameSpacer != null) gameSpacer.setVisibility(View.VISIBLE);
        gameCat.setText(kickerLabel(next.category));
        hintLevel = 0;
        if (gameHint != null) {
            boolean kids = isKidsMode || "kids".equals(next.category);
            gameHint.setVisibility(kids ? View.VISIBLE : View.GONE);
            gameHint.setEnabled(true);
        }
        paintRack();
        paintShare(null);
        paintChart();
        if (isTrainingMode) {
            paintTrainingProgress();
            startTrainingTimer();
        }
    }

    /**
     * Aligns pickedTiles with the typed word: position k of the word maps to
     * rack index pickedTiles.get(k), or -1 when the char has no free tile.
     * Tiles picked by tap survive keyboard edits; the rest match greedily
     * (exact letter first, joker last).
     */
    private void syncPicks(String word) {
        String rack = deal == null ? "" : deal.rack;
        ArrayList<Integer> prev = new ArrayList<>(pickedTiles);
        pickedTiles.clear();
        boolean[] taken = new boolean[rack.length()];
        int prevPos = 0;
        for (int k = 0; k < word.length(); k++) {
            char ch = word.charAt(k);
            int use = -1;
            for (int p = prevPos; p < prev.size(); p++) {
                Integer idx = prev.get(p);
                if (idx != null && idx >= 0 && idx < rack.length() && !taken[idx] && rack.charAt(idx) == ch) {
                    use = idx;
                    prevPos = p + 1;
                    break;
                }
            }
            if (use < 0) {
                for (int j = 0; j < rack.length(); j++) {
                    if (!taken[j] && rack.charAt(j) == ch) {
                        use = j;
                        break;
                    }
                }
            }
            if (use < 0) {
                for (int j = 0; j < rack.length(); j++) {
                    if (!taken[j] && rack.charAt(j) == '?') {
                        use = j;
                        break;
                    }
                }
            }
            pickedTiles.add(use);
            if (use >= 0) taken[use] = true;
        }
    }

    private void paintRack() {
        if (deal == null) return;
        String typed = Lexicon.normalize(gameQ.getText().toString());
        syncPicks(typed);
        if (gameRackTools != null) gameRackTools.setVisibility(closed ? View.GONE : View.VISIBLE);
        if (gameSkip != null) gameSkip.setVisibility(closed || isTrainingMode ? View.GONE : View.VISIBLE);
        HashSet<Integer> used = new HashSet<>();
        for (Integer idx : pickedTiles) if (idx != null && idx >= 0) used.add(idx);
        Tiles.fill(gameRack, deal.rack, closed ? null : used, closed ? null : v -> {
            int i = (Integer) v.getTag();
            char ch = deal.rack.charAt(i);
            String word = Lexicon.normalize(gameQ.getText().toString());
            syncPicks(word);
            int at = pickedTiles.indexOf(i);
            if (at >= 0) {
                // Deselect exactly the tapped tile — its own char leaves the word.
                word = word.substring(0, at) + word.substring(at + 1);
                pickedTiles.remove(at);
            } else if (ch == '?') {
                Toast.makeText(this, R.string.joker_type_letter, Toast.LENGTH_SHORT).show();
                gameQ.requestFocus();
                return;
            } else {
                word = word + ch;
                pickedTiles.add(i);
            }
            gameQ.setText(word);
            gameQ.setSelection(word.length());
        }, deal.bonusIndex, rackAlpha);
    }

    private void paintAlphaBtn() {
        if (gameAlpha == null) return;
        gameAlpha.setVisibility(alphaBtnOn ? View.VISIBLE : View.GONE);
        gameAlpha.setBackgroundResource(rackAlpha ? R.drawable.bg_pill : R.drawable.bg_count);
        gameAlpha.setTextColor(getColor(rackAlpha ? R.color.gold : R.color.dim));
    }

    private void paintClearAll() {
        boolean hide = closed || gameQ == null || gameQ.getText().toString().isEmpty();
        if (gameClear != null) gameClear.setVisibility(hide ? View.GONE : View.VISIBLE);
    }

    private void paintFavStar(TextView star, String word) {
        if (star == null) return;
        boolean on = word != null && !word.isEmpty() && FavStore.has(this, word);
        star.setText(on ? "★" : "☆");
        star.setContentDescription(getString(on ? R.string.fav_remove : R.string.fav_add));
    }

    private void previewPlay() {
        paintClearAll();
        if (closed || deal == null) return;
        paintRack();
        String word = Lexicon.normalize(gameQ.getText().toString());
        if (word.isEmpty()) {
            gameLive.setText("");
            return;
        }
        Lexicon.Play hit = lex.findPlay(deal.catalog, word);
        if (hit == null) hit = lex.probe(word, deal.rack);
        // Only positive feedback while typing — the red "not in the list"
        // banner was noise; errors still show on an explicit submit.
        if (hit != null) {
            gameLive.setText(getString(R.string.pts_n, hit.pts()));
            gameLive.setTextColor(getColor(R.color.ok));
        } else {
            gameLive.setText("");
        }
    }

    private void submitPlay() {
        if (closed || deal == null || lex == null) return;
        String word = Lexicon.normalize(gameQ.getText().toString());
        Lexicon.Play hit = lex.findPlay(deal.catalog, word);
        boolean synthetic = false;
        if (hit == null) {
            // Curated catalogs (beginner lists) miss valid words — ATOM on a
            // TOMATO rack must be playable. Probe rack + dictionary first.
            Lexicon.Play probed = lex.probe(word, deal.rack);
            if (probed != null) {
                hit = probed;
                synthetic = true;
            }
        }
        if (isTrainingMode) {
            submitTrainingWord(word, hit);
            return;
        }
        if (hit == null) {
            final CharSequence message;
            if (word.length() < 2) {
                message = getString(isKidsMode ? R.string.kids_need : R.string.need_best);
            } else if (!lex.has(word)) {
                message = getString(R.string.not_in_dict, Dict.label(this));
            } else {
                message = getString(R.string.not_on_rack);
            }
            gameLive.setText(message);
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
        gameBreak.setText(breakLabel(hit.word, hit.pts()));
        gameVs.setText(vs);
        gameResult.setVisibility(View.VISIBLE);
        if (gameAgain != null) gameAgain.setVisibility(View.VISIBLE);
        if (gameSpacer != null) gameSpacer.setVisibility(View.GONE);
        List<Lexicon.Play> tops = Lexicon.topWords(deal.catalog, hit, 5);
        int start = 0;
        for (int i = 0; i < tops.size(); i++) if (tops.get(i).word.equals(hit.word)) start = i;
        paintTops(tops, start, hit.word);
        showDef(tops.get(start).word);
        List<Integer> scores = ScoreStore.add(this, percent, isKidsMode);
        paintChart(scores);
        if (isKidsMode) {
            lastPlayedWord = hit.word;
            lastPlayedPts = hit.pts();
            lastPlayedDef = "";
            paintShare(percent);
        } else if (!isCompetitiveMode) {
            paintShare(percent);
            RemoteApi.postScore(percent, (has, avg) -> {
                publicAverageHas = has;
                publicAverage = avg;
                paintGameAverage();
            });
        }
        HistoryStore.remember(this, hit.word, hit.pts(), "defi");
        if (competitiveMode.loggedIn()) RemoteApi.saveHistory(hit.word, hit.pts(), "defi");
        paintHistory();
        // Off-catalog words can't be scored by the ranked server trail — keep them local.
        if (!synthetic && (isKidsMode || isCompetitiveMode) && competitiveMode.loggedIn() && officialDeal) {
            submitOfficialScore(percent, hit.word, false);
        } else if (isCompetitiveMode || isKidsMode) {
            refreshBoards();
        }
    }

    /** Word + points on one line, points echoing the gold tile values. */
    private CharSequence breakLabel(String word, int pts) {
        String label = word + " " + pts;
        SpannableString span = new SpannableString(label);
        int at = label.length() - String.valueOf(pts).length();
        span.setSpan(new android.text.style.ForegroundColorSpan(getColor(R.color.gold)),
                at, label.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        span.setSpan(new StyleSpan(Typeface.BOLD),
                at, label.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return span;
    }

    /** Give up on the current rack: reveal the best words, record nothing. */
    private void skipPlay() {
        if (closed || deal == null || lex == null || isTrainingMode) return;
        closed = true;
        rankedSubmitGeneration++;
        rankedSubmitInFlight = false;
        pendingRankedPercent = -1;
        pendingRankedWord = "";
        gameQ.setEnabled(false);
        gameForm.setVisibility(View.GONE);
        gameLive.setVisibility(View.GONE);
        paintRack();
        Lexicon.Play best = deal.catalog.isEmpty() ? null : deal.catalog.get(0);
        gamePct.setText("—");
        gameBreak.setText(getString(R.string.skip_done));
        gameVs.setText(best != null
                ? getString(R.string.skip_best) + " " + best.word + " " + best.pts()
                : "");
        gameResult.setVisibility(View.VISIBLE);
        if (gameAgain != null) gameAgain.setVisibility(View.VISIBLE);
        if (gameSpacer != null) gameSpacer.setVisibility(View.GONE);
        if (best != null) {
            List<Lexicon.Play> tops = Lexicon.topWords(deal.catalog, best, 5);
            paintTops(tops, 0, "");
            showDef(tops.get(0).word);
        }
    }

    private void submitTrainingWord(String word, Lexicon.Play hit) {
        if (hit == null) {
            gameLive.setText(word.length() < 2 ? R.string.need_best : R.string.not_playable);
            gameLive.setTextColor(getColor(R.color.no));
            return;
        }
        boolean fresh = trainingFound.add(hit.word);
        int left = Math.max(0, trainingNeeded.size() - trainingNeededFound());
        if (fresh && left > 0) {
            gameLive.setText(getString(R.string.training_found_left, hit.word, hit.pts(), left));
        } else {
            gameLive.setText(fresh ? getString(R.string.training_found, hit.word, hit.pts())
                    : getString(R.string.already_found));
        }
        gameLive.setTextColor(getColor(R.color.ok));
        gameQ.setText("");
        paintTrainingProgress();
        if (trainingRoundSolved()) finishTraining(true);
    }

    private int trainingNeededFound() {
        int n = 0;
        for (String word : trainingNeeded) if (trainingFound.contains(word)) n++;
        return n;
    }

    private boolean trainingRoundSolved() {
        if (trainingNeeded.isEmpty()) return false;
        return trainingFound.containsAll(trainingNeeded);
    }

    private void finishTraining(boolean solved) {
        if (!isTrainingMode || deal == null || closed) return;
        closed = true;
        stopTrainingTimer();
        gameQ.setEnabled(false);
        gameForm.setVisibility(View.GONE);
        gameLive.setVisibility(View.GONE);
        paintRack();
        int total = trainingNeeded.isEmpty() ? deal.catalog.size() : trainingNeeded.size();
        int found = trainingNeededFound();
        int percent = Math.round(100f * found / Math.max(1, total));
        gamePct.setText(percent + "%");
        gameBreak.setText(getString(R.string.training_score, found, total));
        gameVs.setText(solved ? R.string.training_complete : R.string.training_revealed);
        gameResult.setVisibility(View.VISIBLE);
        if (gameAgain != null) gameAgain.setVisibility(View.VISIBLE);
        if (gameSpacer != null) gameSpacer.setVisibility(View.GONE);
        paintTops(deal.catalog, -1, "");
        if (!deal.catalog.isEmpty()) showDef(deal.catalog.get(0).word);
        recordTraining(solved);
        paintTrainingProgress();
    }

    private void submitOfficialScore(int percent, String word, boolean dealAfterSuccess) {
        if (!officialDeal || rankedSubmitInFlight || word == null || word.isEmpty()) return;
        pendingRankedPercent = percent;
        pendingRankedWord = word;
        rankedSubmitInFlight = true;
        final int generation = rankedSubmitGeneration;
        final boolean kids = isKidsMode;
        String rack = deal != null ? deal.rack : null;
        competitiveMode.submitScore(percent, word, kids, rack, accepted -> {
            if (generation != rankedSubmitGeneration) return;
            rankedSubmitInFlight = false;
            if (accepted) {
                officialDeal = false;
                pendingRankedPercent = -1;
                pendingRankedWord = "";
            }
            refreshBoards();
            if (accepted && dealAfterSuccess && lex != null) {
                officialDeal = competitiveMode.loggedIn() && (kids || isCompetitiveMode);
                startDeal(kids ? lex.kidsDeal() : lex.challenge());
            }
        });
    }

    private void refreshBoards() {
        boardKidsTab = isKidsMode;
        syncPlayBoard();
    }

    private void syncPlayBoard() {
        boolean show = !isTrainingMode && (isCompetitiveMode || isKidsMode);
        if (gameBoardWrap != null) gameBoardWrap.setVisibility(show ? View.VISIBLE : View.GONE);
        if (show) competitiveMode.fetchBoards(gameBoard, gameBoardTitle, isKidsMode);
    }

    private void paintTops(List<Lexicon.Play> tops, int selected, String mine) {
        gameTop.removeAllViews();
        int n = tops.size();
        if (n == 0) return;
        // Balanced rows: 5 chips render 3+2, 6 render 3+3 — never 5 then a
        // lone straggler like the old flow wrap (chips have a 72dp min width,
        // so 5 across can overflow narrow phones).
        int maxPerRow = 4;
        int rows = (n + maxPerRow - 1) / maxPerRow;
        int cols = (n + rows - 1) / rows;
        float d = getResources().getDisplayMetrics().density;
        int gap = (int) (6 * d);
        LinearLayout row = null;
        for (int i = 0; i < n; i++) {
            if (i % cols == 0) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                if (i > 0) rlp.topMargin = gap;
                gameTop.addView(row, rlp);
            }
            Lexicon.Play p = tops.get(i);
            TextView chip = Tiles.chip(this, p.word, p.pts(), i == selected, p.word.equals(mine));
            final int idx = i;
            chip.setOnClickListener(v -> {
                paintTops(tops, idx, mine);
                showDef(p.word);
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            if (i % cols > 0) lp.leftMargin = gap;
            row.addView(chip, lp);
        }
    }

    private int defSeq = 0;

    /** "RAPEZ · NOM" — the defined word always leads, so a gloss that actually
     *  belongs to an inflection or root is never ambiguous. */
    private String defHeader(String word, String pos) {
        String w = word == null ? "" : word.toUpperCase(java.util.Locale.ROOT);
        if (pos == null || pos.isEmpty()) return w;
        return w.isEmpty() ? pos : w + " · " + pos;
    }

    private void setGameDefWord(String word) {
        gameDefWord = word == null ? "" : Lexicon.normalize(word);
        paintFavStar(gameFav, gameDefWord);
    }

    private void showDef(String word) {
        // A later chip tap supersedes any in-flight lookup: without this guard
        // the slower response repainted the panel with the wrong word's entry.
        final int seq = ++defSeq;
        gamePos.setText(defHeader(word, ""));
        setGameDefWord(word);
        gameDef.setText(R.string.def_pending);
        if (gameLemma != null) gameLemma.setVisibility(View.GONE);
        RemoteApi.define(word, new RemoteApi.DefCb() {
            @Override
            public void ok(String pos, String text, String url, String lemma) {
                if (seq != defSeq) return;
                gamePos.setText(defHeader(word, pos));
                paintGameDef(text, lemma, word, word);
                if (isKidsMode && word.equals(lastPlayedWord)) {
                    lastPlayedDef = text == null ? "" : text;
                    paintShare(null);
                }
            }

            @Override
            public void empty(String message) {
                if (seq != defSeq) return;
                gamePos.setText(defHeader(word, ""));
                gameDef.setText(defMessage(message));
                if (gameLemma != null) gameLemma.setVisibility(View.GONE);
            }
        }, Lang.get(this));
    }

    private void paintShare(Integer percent) {
        if (deal == null || isTrainingMode) {
            gameWa.setVisibility(View.INVISIBLE);
            return;
        }
        if (isKidsMode) {
            if (closed && lastPlayedWord != null && !lastPlayedWord.isEmpty()) {
                String def = lastPlayedDef == null || lastPlayedDef.isEmpty() ? "" : lastPlayedDef;
                waText = getString(R.string.share_study_word_body, lastPlayedWord, lastPlayedWord.length(), lastPlayedPts, def);
                gameWa.setVisibility(bubblesOn ? View.VISIBLE : View.INVISIBLE);
            } else {
                gameWa.setVisibility(View.INVISIBLE);
            }
            return;
        }
        StringBuilder tiles = new StringBuilder();
        for (int i = 0; i < deal.rack.length(); i++) {
            if (i > 0) tiles.append(' ');
            tiles.append(deal.rack.charAt(i));
        }
        String score = percent != null ? getString(R.string.share_game_score, percent) : "\n";
        waText = getString(R.string.share_game, tiles.toString(), score, deal.rack, deal.category);
        gameWa.setVisibility(bubblesOn ? View.VISIBLE : View.INVISIBLE);
    }

    private void paintChart() {
        boolean kids = isKidsMode;
        paintChart(ScoreStore.load(this, kids));
    }

    private void paintChart(List<Integer> scores) {
        boolean has = scores != null && !scores.isEmpty();
        boolean spark = scores != null && scores.size() >= 2;
        String last = has ? String.valueOf(scores.get(scores.size() - 1)) : "";
        String avg = "";
        if (spark) {
            int sum = 0;
            for (int score : scores) sum += score;
            avg = String.format(new java.util.Locale(Lang.get(this)), "%.1f",
                    Math.round(10.0 * sum / scores.size()) / 10.0);
        }
        if (gameChart != null) {
            gameChart.setScores(has ? scores : java.util.Collections.emptyList());
            gameChart.setVisibility(has ? View.VISIBLE : View.INVISIBLE);
        }
        if (gameChartAvg != null) gameChartAvg.setText(avg);
        if (gameChartAvgUnit != null) gameChartAvgUnit.setVisibility(spark ? View.VISIBLE : View.GONE);
        if (gameLast != null) gameLast.setText(last);
        if (gameLastUnit != null) gameLastUnit.setVisibility(has ? View.VISIBLE : View.GONE);
        if (boardChart != null) boardChart.setScores(spark ? scores : java.util.Collections.emptyList());
        if (boardChartAvg != null) boardChartAvg.setText(avg);
        if (boardChartAvgUnit != null) boardChartAvgUnit.setVisibility(spark ? View.VISIBLE : View.GONE);
        if (boardChartLast != null) boardChartLast.setText(last);
        syncGameDock();
    }

    private void share(String text) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, text);
        startActivity(Intent.createChooser(i, getString(R.string.share)));
    }

    @Override
    protected void onDestroy() {
        stopTrainingTimer();
        checkHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (tab != 0) showTab(0);
        else super.onBackPressed();
    }
}
