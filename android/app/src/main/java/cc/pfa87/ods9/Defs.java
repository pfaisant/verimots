package cc.pfa87.ods9;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pull the source lemma out of a Wiktionnaire inflection gloss. */
final class Defs {
    private static final String WORD = "([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'\\-]{1,20})";
    private static final int FLAGS = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
    private static final Pattern[] FORM_OF = {
        Pattern.compile("du verbe\\s+" + WORD, FLAGS),
        Pattern.compile("imp[eé]ratif de\\s+" + WORD, FLAGS),
        Pattern.compile("pluriel de(?: l['’](?:adjectif|nom|article))?\\s+" + WORD, FLAGS),
        Pattern.compile("f[eé]minin de(?: l['’]adjectif)?\\s+" + WORD, FLAGS),
        Pattern.compile("masculin de\\s+" + WORD, FLAGS),
        Pattern.compile("singulier de\\s+" + WORD, FLAGS),
        Pattern.compile("participe (?:pass[eé]|pr[eé]sent)\\b(?:[^.]{0,40}?)(?:du verbe|de)\\s+" + WORD, FLAGS),
        Pattern.compile("forme(?:s)? de\\s+" + WORD, FLAGS),
        Pattern.compile("plural of\\s+" + WORD, FLAGS),
        Pattern.compile("(?:simple )?past(?: tense)? of\\s+" + WORD, FLAGS),
        Pattern.compile("present participle of\\s+" + WORD, FLAGS),
        Pattern.compile("(?:third-person singular|3rd.?person singular)(?: present)? of\\s+" + WORD, FLAGS),
        Pattern.compile("(?:comparative|superlative)(?: form)? of\\s+" + WORD, FLAGS),
        Pattern.compile("(?:alternative form|alt form|misspelling|abbreviation|initialism) of\\s+" + WORD, FLAGS),
    };

    private Defs() {}

    static String extractFormOf(String text) {
        if (text == null || text.isEmpty()) return "";
        for (Pattern p : FORM_OF) {
            Matcher m = p.matcher(text);
            if (m.find()) {
                String w = m.group(1).replaceAll("[.,;:]+$", "");
                if (w.length() >= 2) return w;
            }
        }
        return "";
    }
}
