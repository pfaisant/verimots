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
                if (EN.equals(system) || ES.equals(system) || FR.equals(system)) return system;
            }
        }
        String v = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, FR);
        return EN.equals(v) || ES.equals(v) ? v : FR;
    }

    static boolean isEn(Context c) {
        return EN.equals(get(c));
    }

    static boolean isEs(Context c) {
        return ES.equals(get(c));
    }

    static void set(Context c, String lang) {
        String selected = EN.equals(lang) || ES.equals(lang) ? lang : FR;
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
