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
        axis.setColor(0x1AF4EFE4);
        axis.setStrokeWidth(d);
        mid.setColor(0x73F4EFE4);
        mid.setStrokeWidth(d);
        mid.setPathEffect(new android.graphics.DashPathEffect(new float[] {3 * d, 3 * d}, 0));
        bar.setColor(0x85E8C56B);
        bar.setStyle(Paint.Style.FILL);
        barLast.setColor(0xFFF8E3A4);
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
        // Same language as the web dock: full-width rounded bars on faint
        // 0/100 rails with a dashed average line — the avg and last numbers
        // live outside the chart, so no in-plot labels.
        float d = getResources().getDisplayMetrics().density;
        float w = getWidth();
        float h = getHeight();
        float padT = 3 * d;
        float padB = 2 * d;
        float innerH = Math.max(1, h - padT - padB);
        float y0 = padT + innerH;

        c.drawLine(0, y0, w, y0, axis);
        c.drawLine(0, padT, w, padT, axis);

        if (scores.isEmpty()) return;

        int n = scores.size();
        float gap = (n > 16 ? 2 : 3) * d;
        float slot = w / n;
        float barW = Math.max(1.5f * d, slot - gap);
        float radius = Math.min(3 * d, barW / 2f);
        float sum = 0;

        for (int i = 0; i < n; i++) {
            int pct = Math.max(0, Math.min(100, scores.get(i)));
            sum += pct;
            float x = i * slot + gap / 2f;
            float top = padT + (1 - pct / 100f) * innerH;
            if (y0 - top < 2 * d) top = y0 - 2 * d;
            rect.set(x, top, x + barW, y0);
            c.drawRoundRect(rect, radius, radius, i == n - 1 ? barLast : bar);
        }
        if (n > 1) {
            float yAvg = padT + (1 - sum / n / 100f) * innerH;
            c.drawLine(0, yAvg, w, yAvg, mid);
        }
    }
}
