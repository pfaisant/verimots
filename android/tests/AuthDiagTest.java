package cc.pfa87.ods9;

public final class AuthDiagTest {
    private static int checks;

    private static void check(boolean condition, String message) {
        checks++;
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        // Credential Manager's own dismissal message (RESULT_CANCELED).
        check(AuthDiag.userCancelled(true, "activity is cancelled by the user."), "Closing the sheet is a cancel");
        check(AuthDiag.userCancelled(true, null), "A bare cancellation is the player's");
        check(AuthDiag.userCancelled(true, "16: Cancelled by user."), "One Tap dismissal is a cancel");
        // Google's status 16 after an account was picked, with an unregistered certificate.
        check(!AuthDiag.userCancelled(true, "[16] Account reauth failed."), "Reauth failure is not a cancel");
        check(AuthDiag.googleRejectedApp("[16] Account reauth failed."), "Reauth failure means Google refused the app");
        check(AuthDiag.googleRejectedApp("16: Account reauth failed."), "Status prefix without brackets");
        check(AuthDiag.googleRejectedApp("10: [28444] Developer console is not set up correctly."), "Developer console error");
        check(!AuthDiag.googleRejectedApp("activity is cancelled by the user."), "A cancel is not a refusal");
        check(!AuthDiag.googleRejectedApp("No credentials available"), "No account is not a refusal");
        check(!AuthDiag.userCancelled(false, "activity is cancelled by the user."), "Only cancellations can be cancels");
        check(!AuthDiag.userCancelled(true, "Unknown error"), "Other status-16 text falls through to the fallbacks");

        String jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl";
        check(!AuthDiag.scrub("token " + jwt).contains("eyJ"), "ID tokens are hidden");
        check(AuthDiag.scrub("verimots://auth?token=abc123&state=xyz").equals("verimots://auth?token=<hidden>&state=<hidden>"),
                "Hand-back parameters are hidden: " + AuthDiag.scrub("verimots://auth?token=abc123&state=xyz"));
        check(AuthDiag.scrub("{\"idToken\":\"secret\"}").equals("{\"idToken\":\"<hidden>\"}"), "JSON token fields are hidden");
        check(AuthDiag.scrub("signed in as paul.example@gmail.com").equals("signed in as <email>"), "Addresses are hidden");
        check(AuthDiag.scrub("a\nb").equals("a b"), "One entry stays on one line");
        check(AuthDiag.scrub("x".repeat(700)).length() == 601, "Entries are capped");
        check(AuthDiag.scrub("/api/auth/google answered HTTP 401").equals("/api/auth/google answered HTTP 401"), "Plain text is untouched");

        check(AuthDiag.fingerprint(new byte[]{0x60, 0x14, (byte) 0xD1}).equals("60:14:D1"), "Fingerprint format");
        check(AuthDiag.releaseSigned(AuthDiag.RELEASE_SHA1.toLowerCase()), "Release key recognised");
        check(!AuthDiag.releaseSigned("00:11"), "Another key is not the release key");
        System.out.println("AuthDiag: " + checks + " checks passed");
    }
}
