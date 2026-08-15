package cc.pfa87.ods9;

import android.content.Context;
import android.graphics.Typeface;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Set;

final class Tiles {
    static void fill(LinearLayout row, String word, Set<Integer> used, View.OnClickListener tap) {
        Context ctx = row.getContext();
        float d = ctx.getResources().getDisplayMetrics().density;
        row.removeAllViews();
        int n = word.length();
        int size = n >= 7 ? 42 : n >= 5 ? 48 : 54;
        for (int i = 0; i < n; i++) {
            char ch = word.charAt(i);
            FrameLayout cell = new FrameLayout(ctx);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams((int) (size * d), (int) ((size + 6) * d));
            if (i > 0) lp.setMarginStart((int) (6 * d));
            cell.setLayoutParams(lp);
            cell.setBackgroundResource(R.drawable.bg_tile);

            boolean blank = ch == '?' || ch == '.' || ch == '*';
            TextView letter = new TextView(ctx);
            letter.setGravity(Gravity.CENTER);
            letter.setText(blank ? "?" : String.valueOf(ch));
            letter.setTextColor(ctx.getColor(R.color.tile_ink));
            letter.setTextSize(TypedValue.COMPLEX_UNIT_SP, size >= 52 ? 22 : 17);
            letter.setTypeface(Typeface.create("serif", Typeface.BOLD));
            cell.addView(letter, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

            TextView pts = new TextView(ctx);
            pts.setText(blank ? "0" : String.valueOf(Lexicon.letterScore(ch)));
            pts.setTextColor(0xB31A1408);
            pts.setTextSize(TypedValue.COMPLEX_UNIT_SP, 8);
            pts.setTypeface(Typeface.DEFAULT_BOLD);
            FrameLayout.LayoutParams pl = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
            pl.gravity = Gravity.END | Gravity.BOTTOM;
            pl.setMargins(0, 0, (int) (4 * d), (int) (5 * d));
            cell.addView(pts, pl);

            cell.setAlpha(used != null && used.contains(i) ? 0.28f : 1f);
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
        t.setMinWidth((int) (96 * d));
        t.setGravity(Gravity.CENTER);
        t.setPadding((int) (10 * d), (int) (9 * d), (int) (10 * d), (int) (9 * d));
        t.setBackgroundResource(on ? R.drawable.bg_chip_on : mine ? R.drawable.bg_chip_mine : R.drawable.bg_chip);
        t.setTextColor(ctx.getColor(on ? R.color.gold : mine ? R.color.ok : R.color.muted));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        t.setLetterSpacing(0.04f);
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
