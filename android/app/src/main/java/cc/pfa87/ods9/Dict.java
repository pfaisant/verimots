package cc.pfa87.ods9;

import android.content.Context;

/** Selected word list. Language follows the dictionary. */
final class Dict {
    static final String ODS = "ods";
    static final String CSW = "csw";
    static final String YAWL = "yawl";
    static final String WOW24 = "wow24";
    static final String RLA = "rla";
    private static final String PREFS = "verimots-prefs";
    private static final String KEY = "dict";
    private static final String KEY_EN = "dict-en";

    private Dict() {}

    static String normalize(String dict) {
        if (YAWL.equals(dict)) return CSW;
        if (ODS.equals(dict) || CSW.equals(dict) || WOW24.equals(dict) || RLA.equals(dict)) return dict;
        return "";
    }

    static String get(Context c) {
        String v = normalize(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, ""));
        if (!v.isEmpty()) return v;
        return defaultFor(Lang.get(c));
    }

    static String langOf(String dict) {
        String id = normalize(dict);
        if (CSW.equals(id) || WOW24.equals(id)) return Lang.EN;
        if (RLA.equals(id)) return Lang.ES;
        return Lang.FR;
    }

    static String defaultFor(String lang) {
        if (Lang.EN.equals(lang)) return WOW24;
        if (Lang.ES.equals(lang)) return RLA;
        return ODS;
    }

    static String lastEnglish(Context c) {
        String v = normalize(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_EN, WOW24));
        return CSW.equals(v) ? CSW : WOW24;
    }

    static String label(Context c) {
        String dict = get(c);
        if (CSW.equals(dict)) return c.getString(R.string.dict_using_csw);
        if (WOW24.equals(dict)) return c.getString(R.string.dict_using_wow24);
        if (RLA.equals(dict)) return c.getString(R.string.dict_using_rla);
        return c.getString(R.string.dict_using_ods);
    }

    static void set(Context c, String dict) {
        String selected = normalize(dict);
        if (selected.isEmpty()) selected = ODS;
        android.content.SharedPreferences.Editor ed = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY, selected);
        if (Lang.EN.equals(langOf(selected))) ed.putString(KEY_EN, selected);
        ed.apply();
    }

    static void syncFromLang(Context c, String lang) {
        String current = get(c);
        if (!langOf(current).equals(lang)) {
            set(c, Lang.EN.equals(lang) ? lastEnglish(c) : defaultFor(lang));
        }
    }
}
