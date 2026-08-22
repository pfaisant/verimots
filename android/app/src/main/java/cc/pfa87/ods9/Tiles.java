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
        row.removeAllViews();
        int n = word == null ? 0 : word.length();
        if (n == 0) return;

        ViewParent parent = row.getParent();
        boolean fit = !(parent instanceof HorizontalScrollView);
        int pad = row.getPaddingLeft() + row.getPaddingRight();
        int available = row.getWidth() - pad;
        if (available <= 0 && fit && row.isAttachedToWindow()) {
            row.post(() -> {
                if (row.getWidth() > 0) fill(row, word, used, tap, bonusIndex, alpha);
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
                    i == bonusIndex ? R.drawable.bg_gold_btn
                            : spent ? R.drawable.bg_tile_used
                                    : R.drawable.bg_tile);
            if (i == bonusIndex) cell.setContentDescription("+1 " + ch);

            boolean blank = ch == '?' || ch == '.' || ch == '*';
            TextView letter = new TextView(ctx);
            letter.setGravity(Gravity.CENTER);
            letter.setText(blank ? "?" : String.valueOf(ch));
            letter.setTextColor(ctx.getColor(spent ? R.color.tile_used_ink : R.color.tile_ink));
            letter.setTextSize(TypedValue.COMPLEX_UNIT_PX, letterPx);
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

    static TextView chip(Context ctx, String word, int pts, boolean on, boolean mine) {
        float d = ctx.getResources().getDisplayMetrics().density;
        TextView t = new TextView(ctx);
        t.setMinWidth((int) (72 * d));
        t.setGravity(Gravity.CENTER);
        t.setPadding((int) (8 * d), (int) (6 * d), (int) (8 * d), (int) (6 * d));
        t.setBackgroundResource(on ? R.drawable.bg_chip_on : mine ? R.drawable.bg_chip_mine : R.drawable.bg_chip);
        t.setTextColor(ctx.getColor(on ? R.color.gold : mine ? R.color.ok : R.color.muted));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        t.setLetterSpacing(0.04f);
        t.setText(word + "\n" + pts);
        t.setTag(word);
        return t;
    }

    static TextView studyTile(Context ctx, String word) {
        int pts = 0;
        for (int i = 0; i < word.length(); i++) pts += Lexicon.letterScore(word.charAt(i));
        float d = ctx.getResources().getDisplayMetrics().density;
        TextView t = new TextView(ctx);
        t.setMinWidth((int) (52 * d));
        t.setGravity(Gravity.CENTER);
        t.setPadding((int) (8 * d), (int) (7 * d), (int) (8 * d), (int) (6 * d));
        t.setBackgroundResource(R.drawable.bg_tile);
        t.setTextColor(ctx.getColor(R.color.tile_ink));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        t.setTypeface(Typeface.create("serif", Typeface.BOLD));
        t.setLetterSpacing(0.06f);
        t.setText(word + "\n" + pts);
        t.setTag(word);
        return t;
    }

    static TextView resultChip(Context ctx, String word, int pts, int[] jokers) {
        float d = ctx.getResources().getDisplayMetrics().density;
        TextView t = new TextView(ctx);
        String shown = word;
        if (jokers != null) {
            char[] a = word.toCharArray();
            for (int j : jokers) if (j >= 0 && j < a.length) a[j] = '?';
            shown = new String(a);
        }
        t.setText(shown + "  " + pts);
        t.setTextColor(ctx.getColor(R.color.ink));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        t.setLetterSpacing(0.04f);
        t.setPadding((int) (10 * d), (int) (8 * d), (int) (10 * d), (int) (8 * d));
        t.setBackgroundResource(R.drawable.bg_chip);
        t.setTag(word);
        return t;
    }
}
