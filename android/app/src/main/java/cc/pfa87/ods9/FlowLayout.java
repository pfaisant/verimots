package cc.pfa87.ods9;

import android.content.Context;
import android.content.res.TypedArray;
import android.util.AttributeSet;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;

/** Wrapping row of chips. Honours android:gravity="center_horizontal" so a
 *  short pill row sits centred like the web flex rows (justify-content). */
public class FlowLayout extends ViewGroup {
    private final int gap = (int) (6 * getResources().getDisplayMetrics().density);
    private boolean center;

    public FlowLayout(Context c) {
        super(c);
    }

    public FlowLayout(Context c, AttributeSet a) {
        this(c, a, 0);
    }

    public FlowLayout(Context c, AttributeSet a, int s) {
        super(c, a, s);
        if (a == null) return;
        TypedArray t = c.obtainStyledAttributes(a, new int[]{android.R.attr.gravity});
        try {
            int g = t.getInt(0, Gravity.START);
            center = (g & Gravity.HORIZONTAL_GRAVITY_MASK) == Gravity.CENTER_HORIZONTAL;
        } finally {
            t.recycle();
        }
    }

    public void setCenterRows(boolean on) {
        if (center == on) return;
        center = on;
        requestLayout();
    }

    @Override
    protected void onMeasure(int wSpec, int hSpec) {
        int maxW = MeasureSpec.getSize(wSpec);
        int x = 0, y = 0, rowH = 0;
        int count = getChildCount();
        for (int i = 0; i < count; i++) {
            View ch = getChildAt(i);
            if (ch.getVisibility() == GONE) continue;
            measureChild(ch, wSpec, hSpec);
            int cw = ch.getMeasuredWidth();
            int chh = ch.getMeasuredHeight();
            if (x > 0 && x + cw > maxW) {
                x = 0;
                y += rowH + gap;
                rowH = 0;
            }
            x += cw + gap;
            rowH = Math.max(rowH, chh);
        }
        int h = y + rowH + getPaddingTop() + getPaddingBottom();
        setMeasuredDimension(maxW, resolveSize(h, hSpec));
    }

    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
        int maxW = r - l;
        int count = getChildCount();
        int start = 0;
        int rowY = 0;
        while (start < count) {
            // Gather one row, then place it (optionally centred).
            int x = 0, rowH = 0, end = start;
            while (end < count) {
                View ch = getChildAt(end);
                if (ch.getVisibility() == GONE) {
                    end++;
                    continue;
                }
                int cw = ch.getMeasuredWidth();
                if (x > 0 && x + cw > maxW) break;
                x += cw + gap;
                rowH = Math.max(rowH, ch.getMeasuredHeight());
                end++;
            }
            int rowW = Math.max(0, x - gap);
            int offset = center ? Math.max(0, (maxW - rowW) / 2) : 0;
            int cx = offset;
            for (int i = start; i < end; i++) {
                View ch = getChildAt(i);
                if (ch.getVisibility() == GONE) continue;
                int cw = ch.getMeasuredWidth();
                int chh = ch.getMeasuredHeight();
                ch.layout(cx, rowY, cx + cw, rowY + chh);
                cx += cw + gap;
            }
            rowY += rowH + gap;
            if (end == start) end++;
            start = end;
        }
    }
}
