package cc.pfa87.ods9;

import android.app.LocaleManager;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Build;
import android.os.LocaleList;

import java.util.Locale;

/** App language. Default is French even on an English device. */
final class Lang {
    static final String FR = "fr";
    static final String EN = "en";
    static final String ES = "es";
    static final String CA = "ca";
    /** Supported UI languages, in the order the header toggle shows them. */
    static final String[] ALL = {FR, EN, ES, CA};
    private static final String PREFS = "verimots-prefs";
    private static final String KEY = "lang";

    private Lang() {}

    static String get(Context c) {
        if (Build.VERSION.SDK_INT >= 33) {
            LocaleManager manager = c.getSystemService(LocaleManager.class);
            LocaleList locales = manager == null ? null : manager.getApplicationLocales();
            if (locales != null) {
                if (locales.isEmpty()) return FR;
                String system = locales.get(0).getLanguage();
                if (supported(system)) return system;
            }
        }
        String v = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, FR);
        return supported(v) ? v : FR;
    }

    static boolean supported(String lang) {
        for (String candidate : ALL) {
            if (candidate.equals(lang)) return true;
        }
        return false;
    }

    static boolean isEn(Context c) {
        return EN.equals(get(c));
    }

    static boolean isEs(Context c) {
        return ES.equals(get(c));
    }

    static boolean isCa(Context c) {
        return CA.equals(get(c));
    }

    /**
     * Plural ending for the "tile" and "word" nouns. French, English and
     * Spanish just add an s; Catalan changes the stem vowel (fitxa → fitxes,
     * paraula → paraules), so the Catalan strings are written "fitx%2$s" and
     * take the whole ending, including the singular "a".
     */
    static String plural(Context c, int n) {
        if (CA.equals(get(c))) return n > 1 ? "es" : "a";
        return n > 1 ? "s" : "";
    }

    static void set(Context c, String lang) {
        String selected = supported(lang) ? lang : FR;
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, selected)
                .apply();
        if (Build.VERSION.SDK_INT >= 33) {
            LocaleManager manager = c.getSystemService(LocaleManager.class);
            if (manager != null) {
                manager.setApplicationLocales(LocaleList.forLanguageTags(selected));
            }
        }
    }

    static Context wrap(Context base) {
        Locale locale = new Locale(get(base));
        Locale.setDefault(locale);
        Configuration cfg = new Configuration(base.getResources().getConfiguration());
        cfg.setLocale(locale);
        return base.createConfigurationContext(cfg);
    }
}
