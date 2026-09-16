package cc.pfa87.ods9;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/** Binds a browser sign-in callback to the device that started it. */
final class BrowserAuthState {
    static final long TTL_MS = 10 * 60 * 1000L;

    private BrowserAuthState() {}

    static String create() {
        byte[] nonce = new byte[32];
        new SecureRandom().nextBytes(nonce);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
    }

    static boolean matches(String expected, String received, long started, long now) {
        if (expected == null || expected.isEmpty() || received == null || received.isEmpty()
                || received.length() > 128 || started <= 0 || now < started || now - started > TTL_MS) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                received.getBytes(StandardCharsets.UTF_8));
    }
}
