package cc.pfa87.ods9;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.text.Layout;
import android.text.Spanned;
import android.text.TextPaint;
import android.text.style.ClickableSpan;
import android.util.AttributeSet;
import android.view.View;
import android.widget.TextView;

/**
 * Definition body whose tappable words read as ordinary text, like
 * {@code button.form-of} on the web: a faint dotted rule under each gloss
 * word, a faint solid one under an inflection's root. A full-strength
 * underline under every word of the gloss made the definition unreadable.
 */
public class DefTextView extends TextView {

    /** A tappable word. {@code root} draws the solid rule of a "form of" link. */
    public static final class Link extends ClickableSpan {
        private final Runnable tap;
        final boolean root;

        public Link(Runnable tap, boolean root) {
            this.tap = tap;
            this.root = root;
        }

        @Override
        public void onClick(View widget) {
            tap.run();
        }

        @Override
        public void updateDrawState(TextPaint ds) {
            ds.setUnderlineText(false);
        }
    }

    private final Paint rule = new Paint();
    private final float dp;

    public DefTextView(Context context) {
        this(context, null);
    }

    public DefTextView(Context context, AttributeSet attrs) {
        super(context, attrs);
        dp = getResources().getDisplayMetrics().density;
        // Web: rgba(183, 196, 184, 0.32) — muted at a third.
        rule.setColor((context.getColor(R.color.muted) & 0x00ffffff) | 0x52000000);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        Layout layout = getLayout();
        CharSequence text = getText();
        if (layout == null || !(text instanceof Spanned)) return;
        Spanned spanned = (Spanned) text;
        Link[] links = spanned.getSpans(0, spanned.length(), Link.class);
        if (links.length == 0) return;
        float left = getTotalPaddingLeft();
        float top = getTotalPaddingTop();
        float thick = Math.max(1f, Math.round(dp));
        float below = Math.round(2.5f * dp);
        int lines = layout.getLineCount();
        for (Link link : links) {
            int start = spanned.getSpanStart(link);
            int end = spanned.getSpanEnd(link);
            for (int line = layout.getLineForOffset(start); line < lines; line++) {
                int lineStart = layout.getLineStart(line);
                if (lineStart >= end) break;
                int lineEnd = layout.getLineEnd(line);
                int a = Math.max(start, lineStart);
                int b = Math.min(end, lineEnd);
                // The last visible line of a collapsed preview stops at its ellipsis.
                if (layout.getEllipsisCount(line) > 0) b = Math.min(b, lineStart + layout.getEllipsisStart(line));
                if (b <= a) continue;
                float x1 = layout.getPrimaryHorizontal(a);
                // An offset at a line break belongs to the next line; use this line's right edge.
                float x2 = b == lineEnd && line < lines - 1 ? layout.getLineRight(line) : layout.getPrimaryHorizontal(b);
                float y = top + layout.getLineBaseline(line) + below;
                if (link.root) {
                    canvas.drawRect(left + x1, y, left + x2, y + thick, rule);
                } else {
                    for (float x = left + x1; x < left + x2; x += thick * 2.5f) {
                        canvas.drawRect(x, y, Math.min(x + thick, left + x2), y + thick, rule);
                    }
                }
            }
        }
    }
}
