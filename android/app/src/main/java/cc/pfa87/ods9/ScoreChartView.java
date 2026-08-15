package cc.pfa87.ods9;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

public class ScoreChartView extends View {
    private final Paint axis = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mid = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint barLast = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint tick = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint hint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private final List<Integer> scores = new ArrayList<>();

    public ScoreChartView(Context c) {
        super(c);
        init();
    }

    public ScoreChartView(Context c, AttributeSet a) {
        super(c, a);
        init();
    }

    private void init() {
        float d = getResources().getDisplayMetrics().density;
        axis.setColor(0x24F4EFE4);
        axis.setStrokeWidth(d);
        mid.setColor(0x40E8C56B);
        mid.setStrokeWidth(d);
        mid.setPathEffect(new android.graphics.DashPathEffect(new float[] {5 * d, 5 * d}, 0));
        bar.setColor(0x66E8C56B);
        bar.setStyle(Paint.Style.FILL);
        barLast.setColor(0xFFE8C56B);
        barLast.setStyle(Paint.Style.FILL);
        tick.setColor(0xFF7D9183);
        tick.setTextSize(10 * d);
        tick.setFakeBoldText(true);
        label.setColor(0xFFF7F2E8);
        label.setTextSize(10 * d);
        label.setFakeBoldText(true);
        label.setTextAlign(Paint.Align.CENTER);
        hint.setColor(0x667D9183);
        hint.setTextSize(11 * d);
        hint.setTextAlign(Paint.Align.CENTER);
    }

    public void setScores(List<Integer> next) {
        scores.clear();
        if (next != null) scores.addAll(next);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas c) {
        float d = getResources().getDisplayMetrics().density;
        float w = getWidth();
        float h = getHeight();
        float padL = 28 * d;
        float padR = 8 * d;
        float padT = 16 * d;
        float padB = 10 * d;
        float innerW = Math.max(1, w - padL - padR);
        float innerH = Math.max(1, h - padT - padB);
        float y0 = padT + innerH;
        float y50 = padT + innerH * 0.5f;
        float y100 = padT;

        c.drawLine(padL, y0, w - padR, y0, axis);
        c.drawLine(padL, y50, w - padR, y50, mid);
        c.drawLine(padL, y100, w - padR, y100, axis);
        tick.setTextAlign(Paint.Align.RIGHT);
        c.drawText("100", padL - 5 * d, y100 + 3.5f * d, tick);
        c.drawText("50", padL - 5 * d, y50 + 3.5f * d, tick);
        c.drawText("0", padL - 5 * d, y0, tick);

        if (scores.isEmpty()) {
            c.drawText("Tes scores", padL + innerW / 2f, padT + innerH / 2f + 4 * d, hint);
            return;
        }

        int n = scores.size();
        int slots = Math.max(n, 6);
        float slot = innerW / slots;
        float barW = Math.min(14 * d, slot * 0.62f);
        float radius = Math.min(4 * d, barW / 2f);
        float start = padL + (slots - n) * slot;

        for (int i = 0; i < n; i++) {
            int pct = Math.max(0, Math.min(100, scores.get(i)));
            float x = start + i * slot + (slot - barW) / 2f;
            float top = padT + (1 - pct / 100f) * innerH;
            if (y0 - top < 4 * d) top = y0 - 4 * d;
            rect.set(x, top, x + barW, y0);
            c.drawRoundRect(rect, radius, radius, i == n - 1 ? barLast : bar);
            if (i == n - 1) {
                c.drawText(String.valueOf(pct), x + barW / 2f, Math.max(padT - 3 * d, top - 4 * d), label);
            }
        }
    }
}
