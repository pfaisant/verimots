package cc.pfa87.ods9;

public final class BrowserAuthStateTest {
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        String state = BrowserAuthState.create();
        long start = 1000000L;
        check(state.matches("[A-Za-z0-9_-]{43}"), "Nonce must contain 256 URL-safe bits");
        check(!state.equals(BrowserAuthState.create()), "Consecutive sign-ins need different nonces");
        check(BrowserAuthState.matches(state, state, start, start), "Fresh callback should match");
        check(BrowserAuthState.matches(state, state, start, start + BrowserAuthState.TTL_MS), "Expiry boundary");
        check(!BrowserAuthState.matches(state, state, start, start + BrowserAuthState.TTL_MS + 1), "Expired callback rejected");
        check(!BrowserAuthState.matches(state, state, start, start - 1), "Clock rollback rejected");
        check(!BrowserAuthState.matches(state, BrowserAuthState.create(), start, start), "Other device rejected");
        check(!BrowserAuthState.matches(state, null, start, start), "Missing callback state rejected");
        check(!BrowserAuthState.matches("", state, start, start), "Consumed or absent state rejected");
        check(!BrowserAuthState.matches(state, state, 0, start), "Missing start time rejected");
        check(!BrowserAuthState.matches(state, "x".repeat(129), start, start), "Oversize callback state rejected");
        System.out.println("BrowserAuthState: 11 checks passed");
    }
}
