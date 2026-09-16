package cc.pfa87.ods9;

import android.content.Context;
import android.graphics.Typeface;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewParent;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.Collator;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

final class Tiles {
    static void fill(LinearLayout row, String word, Set<Integer> used, View.OnClickListener tap) {
        fill(row, word, used, tap, -1, false);
    }

    static void fill(LinearLayout row, String word, Set<Integer> used, View.OnClickListener tap, int bonusIndex) {
        fill(row, word, used, tap, bonusIndex, false);
    }

    static int[] displayOrder(String rack, boolean alpha, Locale locale) {
        int n = rack == null ? 0 : rack.length();
        Integer[] idx = new Integer[n];
        for (int i = 0; i < n; i++) idx[i] = i;
        if (alpha && n > 1) {
            Collator col = Collator.getInstance(locale != null ? locale : Locale.FRENCH);
            col.setStrength(Collator.PRIMARY);
            Arrays.sort(idx, (a, b) -> {
                char ca = rack.charAt(a);
                char cb = rack.charAt(b);
                boolean ba = ca == '?' || ca == '.' || ca == '*';
                boolean bb = cb == '?' || cb == '.' || cb == '*';
                if (ba != bb) return ba ? 1 : -1;
                int c = col.compare(String.valueOf(ca), String.valueOf(cb));
                return c != 0 ? c : Integer.compare(a, b);
            });
        }
        int[] out = new int[n];
        for (int i = 0; i < n; i++) out[i] = idx[i];
        return out;
    }

    static void fill(LinearLayout row, String word, Set<Integer> used, View.OnClickListener tap, int bonusIndex, boolean alpha) {
        Context ctx = row.getContext();
        float d = ctx.getResources().getDisplayMetrics().density;
        Object renderToken = new Object();
        row.setTag(R.id.tile_render_token, renderToken);
        row.removeAllViews();
        int n = word == null ? 0 : word.length();
        if (n == 0) return;

        ViewParent parent = row.getParent();
        boolean fit = !(parent instanceof HorizontalScrollView);
        int pad = row.getPaddingLeft() + row.getPaddingRight();
        int available = row.getWidth() - pad;
        if (available <= 0 && fit) {
            // First launch fills the rack before the pane has been measured; a
            // one-shot post missed that layout and left the rack blank until
            // the next repaint. Refill on the first real layout instead.
            row.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
                @Override
                public void onLayoutChange(View v, int l, int t, int r, int b,
                        int ol, int ot, int or, int ob) {
                    if (row.getWidth() <= 0) return;
                    row.removeOnLayoutChangeListener(this);
                    // Replacing children inside layout can leave them at 0 x 0.
                    // Defer the refill, and discard it if a newer rack was painted.
                    row.post(() -> {
                        if (row.getTag(R.id.tile_render_token) == renderToken)
                            fill(row, word, used, tap, bonusIndex, alpha);
                    });
                }
            });
        }
        if (available <= 0) {
            available = ctx.getResources().getDisplayMetrics().widthPixels - (int) (40 * d) - pad;
        }

        int maxDp = n >= 8 ? 34 : n >= 7 ? 46 : n >= 6 ? 50 : n >= 5 ? 52 : 56;
        int minDp = 26;
        int gapPx = (int) ((n >= 8 ? 3 : 5) * d);
        int sizePx;
        if (fit) {
            sizePx = (available - (n - 1) * gapPx) / n;
            sizePx = Math.max((int) (minDp * d), Math.min((int) (maxDp * d), sizePx));
            int need = n * sizePx + (n - 1) * gapPx;
            if (need > available && n > 1) {
                gapPx = Math.max((int) (2 * d), (available - n * sizePx) / (n - 1));
            }
        } else {
            sizePx = (int) (maxDp * d);
        }
        int tileH = Math.round(sizePx * 1.12f);
        float letterPx = Math.max(13 * d, sizePx * 0.5f);
        float ptsPx = Math.max(8 * d, sizePx * 0.2f);

        row.setClipChildren(false);
        row.setClipToPadding(false);
        Locale loc = new Locale(Lang.get(ctx));
        int[] order = displayOrder(word, alpha, loc);
        for (int slot = 0; slot < n; slot++) {
            int i = order[slot];
            char ch = word.charAt(i);
            FrameLayout cell = new FrameLayout(ctx);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(sizePx, tileH);
            if (slot > 0) lp.setMarginStart(gapPx);
            cell.setLayoutParams(lp);
            boolean spent = used != null && used.contains(i);
            cell.setBackgroundResource(
                    i == bonusIndex ? R.drawable.bg_tile_bonus
                            : spent ? R.drawable.bg_tile_used
                                    : R.drawable.bg_tile);
            if (i == bonusIndex) cell.setContentDescription("+1 " + Lexicon.tileGlyph(ch));

            boolean blank = ch == '?' || ch == '.' || ch == '*';
            TextView letter = new TextView(ctx);
            letter.setGravity(Gravity.CENTER);
            String glyph = blank ? "?" : Lexicon.tileGlyph(ch);
            letter.setText(glyph);
            letter.setTextColor(ctx.getColor(spent ? R.color.tile_used_ink : R.color.tile_ink));
            // A digraph (CH, LL, RR) is one tile carrying two letters: shrink the
            // glyph rather than let it clip or widen the tile.
            letter.setTextSize(TypedValue.COMPLEX_UNIT_PX, glyph.length() > 1 ? letterPx * 0.62f : letterPx);
            letter.setTypeface(Typeface.create("serif", Typeface.BOLD));
            letter.setIncludeFontPadding(false);
            letter.setMaxLines(1);
            letter.setPadding(0, 0, 0, (int) (2 * d));
            cell.addView(letter, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

            TextView pts = new TextView(ctx);
            pts.setText(blank ? "0" : String.valueOf(Lexicon.letterScore(ch)));
            pts.setTextColor(spent ? 0x803D3A32 : 0xB31A1408);
            pts.setTextSize(TypedValue.COMPLEX_UNIT_PX, ptsPx);
            pts.setTypeface(Typeface.DEFAULT_BOLD);
            pts.setIncludeFontPadding(false);
            FrameLayout.LayoutParams pl = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
            pl.gravity = Gravity.END | Gravity.BOTTOM;
            pl.setMargins(0, 0, Math.max(2, sizePx / 12), Math.max(2, sizePx / 10));
            cell.addView(pts, pl);

            if (tap != null) {
                cell.setTag(i);
                cell.setOnClickListener(tap);
            }
            row.addView(cell);
        }
    }

    /** A flat result row: word and score align without individual cards. */
    static LinearLayout wordRow(Context ctx, String word, int pts, boolean selected, boolean mine, int inkColor) {
        float d = ctx.getResources().getDisplayMetrics().density;
        LinearLayout row = new LinearLayout(ctx);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setMinimumHeight(Math.round(48 * d));
        row.setPadding(Math.round(8 * d), 0, Math.round(8 * d), 0);
        row.setBackgroundResource(R.drawable.bg_word_row);
        row.setSelected(selected);
        row.setFocusable(true);
        row.setTag(word);
        String shown = Lexicon.display(word);
        row.setContentDescription(shown + ", " + pts + " " + ctx.getString(R.string.pts_unit));
        TextView label = new TextView(ctx);
        label.setText(shown);
        label.setTextColor(inkColor != 0 ? inkColor : ctx.getColor(selected ? R.color.gold : mine ? R.color.ok : R.color.ink));
        label.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        label.setTextSize(13);
        label.setIncludeFontPadding(false);
        label.setMaxLines(1);
        label.setAutoSizeTextTypeUniformWithConfiguration(10, 13, 1, TypedValue.COMPLEX_UNIT_SP);
        label.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        row.addView(label, new LinearLayout.LayoutParams(0, Math.round(48 * d), 1));
        label.setGravity(Gravity.CENTER_VERTICAL);
        TextView score = new TextView(ctx);
        score.setText(String.valueOf(pts));
        score.setTextSize(12);
        score.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        score.setFontFeatureSettings("tnum");
        score.setTextColor(ctx.getColor(selected ? R.color.gold : R.color.dim));
        score.setPadding(Math.round(8 * d), 0, 0, 0);
        score.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        row.addView(score, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return row;
    }

    static TextView studyTile(Context ctx, String word) {
        float d = ctx.getResources().getDisplayMetrics().density;
        TextView tile = new TextView(ctx);
        tile.setMinWidth(Math.round(52 * d));
        tile.setMinHeight(Math.round(56 * d));
        tile.setGravity(Gravity.CENTER);
        tile.setPadding(Math.round(5 * d), Math.round(5 * d), Math.round(5 * d), Math.round(5 * d));
        tile.setIncludeFontPadding(false);
        tile.setLineSpacing(d, 1f);
        tile.setMaxLines(2);
        tile.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        tile.setTypeface(Typeface.create("serif", Typeface.BOLD));
        // A three-tile word may display more letters (NY, QU, L·L, CH…).
        // Fit both the complete word and its separate, smaller points line.
        tile.setHorizontallyScrolling(false);
        tile.setAutoSizeTextTypeUniformWithConfiguration(12, 17, 1, TypedValue.COMPLEX_UNIT_SP);
        tile.setBackgroundResource(R.drawable.bg_study_tile);
        tile.setTag(word);
        tile.setFocusable(true);
        setStudySelected(tile, false);
        return tile;
    }

    static void setStudySelected(TextView tile, boolean selected) {
        Context ctx = tile.getContext();
        String word = String.valueOf(tile.getTag());
        int pts = 0;
        for (int i = 0; i < word.length(); i++) pts += Lexicon.letterScore(word.charAt(i));
        String shown = Lexicon.display(word);
        String label = shown + "\n" + pts + " " + ctx.getString(R.string.pts_unit);
        android.text.SpannableString styled = new android.text.SpannableString(label);
        int start = shown.length() + 1;
        styled.setSpan(new android.text.style.AbsoluteSizeSpan(10, true), start, label.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        styled.setSpan(new android.text.style.TypefaceSpan("sans-serif"), start, label.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        styled.setSpan(new android.text.style.StyleSpan(Typeface.NORMAL), start, label.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        styled.setSpan(new android.text.style.ForegroundColorSpan(ctx.getColor(selected ? R.color.muted : R.color.tile_used_ink)), start, label.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        tile.setSelected(selected);
        tile.setTextColor(ctx.getColor(selected ? R.color.gold : R.color.tile_ink));
        tile.setText(styled);
        tile.setContentDescription(shown + ", " + pts + " " + ctx.getString(R.string.pts_unit)
                + (selected ? ", " + ctx.getString(R.string.polish_selected) : ""));
    }

    static TextView resultChip(Context ctx, String word, int pts, int[] jokers) {
        return resultChip(ctx, word, pts, jokers, 0);
    }

    static TextView resultChip(Context ctx, String word, int pts, int[] jokers, int inkColor) {
        float d = ctx.getResources().getDisplayMetrics().density;
        TextView t = new TextView(ctx);
        String shown = word;
        if (jokers != null) {
            char[] a = word.toCharArray();
            for (int j : jokers) if (j >= 0 && j < a.length) a[j] = '?';
            shown = new String(a);
        }
        String label = Lexicon.display(shown) + "  " + pts;
        android.text.SpannableString styled = new android.text.SpannableString(label);
        int numberAt = label.length() - String.valueOf(pts).length();
        styled.setSpan(new android.text.style.RelativeSizeSpan(0.78f), numberAt, label.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        styled.setSpan(new android.text.style.ForegroundColorSpan(ctx.getColor(R.color.muted)), numberAt, label.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        t.setText(styled);
        t.setMinHeight(Math.round(48 * d));
        t.setTextColor(inkColor != 0 ? inkColor : ctx.getColor(R.color.ink));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        t.setLetterSpacing(0.04f);
        t.setPadding((int) (10 * d), (int) (8 * d), (int) (10 * d), (int) (8 * d));
        t.setBackgroundResource(R.drawable.bg_word_row);
        t.setTag(word);
        return t;
    }
}
