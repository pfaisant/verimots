package cc.pfa87.ods9;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import android.view.ViewGroup;

public class FlowLayout extends ViewGroup {
    private final int gap = (int) (6 * getResources().getDisplayMetrics().density);

    public FlowLayout(Context c) {
        super(c);
    }

    public FlowLayout(Context c, AttributeSet a) {
        super(c, a);
    }

    public FlowLayout(Context c, AttributeSet a, int s) {
        super(c, a, s);
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
        int x = 0, y = 0, rowH = 0;
        int count = getChildCount();
        for (int i = 0; i < count; i++) {
            View ch = getChildAt(i);
            if (ch.getVisibility() == GONE) continue;
            int cw = ch.getMeasuredWidth();
            int chh = ch.getMeasuredHeight();
            if (x > 0 && x + cw > maxW) {
                x = 0;
                y += rowH + gap;
                rowH = 0;
            }
            ch.layout(x, y, x + cw, y + chh);
            x += cw + gap;
            rowH = Math.max(rowH, chh);
        }
    }
}
