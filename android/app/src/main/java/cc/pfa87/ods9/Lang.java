package cc.pfa87.ods9;

import android.content.Context;
import android.content.res.Configuration;

import java.util.Locale;

/** App language. Default is French even on an English device. */
final class Lang {
    static final String FR = "fr";
    static final String EN = "en";
    private static final String PREFS = "verimots-prefs";
    private static final String KEY = "lang";

    private Lang() {}

    static String get(Context c) {
        String v = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, FR);
        return EN.equals(v) ? EN : FR;
    }

    static boolean isEn(Context c) {
        return EN.equals(get(c));
    }

    static void set(Context c, String lang) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, EN.equals(lang) ? EN : FR)
                .apply();
    }

    static Context wrap(Context base) {
        Locale locale = new Locale(get(base));
        Locale.setDefault(locale);
        Configuration cfg = new Configuration(base.getResources().getConfiguration());
        cfg.setLocale(locale);
        return base.createConfigurationContext(cfg);
    }
}
