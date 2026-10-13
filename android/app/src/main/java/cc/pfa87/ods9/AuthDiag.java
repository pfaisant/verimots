package cc.pfa87.ods9;

import java.util.Locale;
import java.util.regex.Pattern;

/** Plain-Java rules behind the technical log and the sign-in fallbacks
 *  (no Android type, so tests/run-auth-state-tests.sh runs them off-device). */
final class AuthDiag {
    /** SHA-1 of the key this repo signs with (the Play upload key). A copy
     *  installed from Google Play carries Google's app-signing key instead. */
    static final String RELEASE_SHA1 = "60:14:D1:85:5A:98:EB:CF:09:1A:BA:BB:1A:5B:FD:08:09:55:69:D2";

    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]{8,}(\\.[A-Za-z0-9_-]*){0,2}");
    private static final Pattern SECRET_PARAM = Pattern.compile("(?i)((?:token|app_auth|state|idToken|nonce)[\"']?\\s*[=:]\\s*[\"']?)[^&\\s\"',}]+");
    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");

    private AuthDiag() {}

    private static String lower(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT);
    }

    /** Google Play services refused this copy of the app after the player
     *  picked an account: "[16] Account reauth failed" when the signing
     *  certificate is not registered for the OAuth client, or
     *  "Developer console is not set up correctly" ([28444]). */
    static boolean googleRejectedApp(String message) {
        String m = lower(message);
        return m.contains("reauth") || m.contains("developer console") || m.contains("28444");
    }

    /** Credential Manager maps every Google status 16 to a cancellation, so a
     *  cancellation is only the player's own when its message says so (the
     *  library's "activity is cancelled by the user."). */
    static boolean userCancelled(boolean cancellation, String message) {
        if (!cancellation || googleRejectedApp(message)) return false;
        String m = lower(message);
        return m.isEmpty() || m.contains("cancel");
    }

    /** Last line of defence: the log never keeps a token, a nonce or an address. */
    static String scrub(String text) {
        return scrub(text, 600);
    }

    static String scrub(String text, int max) {
        if (text == null) return "";
        String out = JWT.matcher(text).replaceAll("<token>");
        out = SECRET_PARAM.matcher(out).replaceAll("$1<hidden>");
        out = EMAIL.matcher(out).replaceAll("<email>");
        out = out.replace('\n', ' ').replace('\r', ' ');
        return out.length() > max ? out.substring(0, max) + "…" : out;
    }

    static String fingerprint(byte[] digest) {
        if (digest == null || digest.length == 0) return "?";
        StringBuilder sb = new StringBuilder(digest.length * 3);
        for (byte b : digest) {
            if (sb.length() > 0) sb.append(':');
            sb.append(String.format(Locale.ROOT, "%02X", b & 0xff));
        }
        return sb.toString();
    }

    static boolean releaseSigned(String sha1) {
        return RELEASE_SHA1.equalsIgnoreCase(sha1 == null ? "" : sha1.trim());
    }
}
