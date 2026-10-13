package cc.pfa87.ods9;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** On-device technical log behind Options → "Technical log": sign-in steps,
 *  failed server calls and crashes, newest last. It lives in the app's
 *  private files and leaves the phone only through Copy or Share; text goes
 *  through AuthDiag.scrub, so no token, nonce or address is kept. */
final class DiagLog {
    private static final int KEEP = 400;
    private static final ArrayDeque<String> LINES = new ArrayDeque<>();
    private static final ExecutorService DISK = Executors.newSingleThreadExecutor();
    private static File file;
    private static int fileLines;

    private DiagLog() {}

    static synchronized void init(Context context) {
        if (file != null) return;
        file = new File(context.getApplicationContext().getFilesDir(), "diag.log");
        try {
            if (file.exists()) {
                List<String> old = Files.readAllLines(file.toPath(), StandardCharsets.UTF_8);
                for (int i = Math.max(0, old.size() - KEEP); i < old.size(); i++) LINES.add(old.get(i));
                fileLines = old.size();
            }
        } catch (Exception ignored) {
            // An unreadable log starts again empty; it never blocks the app.
        }
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            crash(thread, error);
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    static void i(String tag, String message) {
        add("I", tag, message);
    }

    static void w(String tag, String message) {
        add("W", tag, message);
    }

    static void error(String tag, String what, Throwable e) {
        add("W", tag, what + ": " + describe(e));
    }

    /** Class and message; proguard-rules.pro keeps exception names through R8. */
    static String describe(Throwable e) {
        if (e == null) return "?";
        String message = e.getMessage() == null ? "" : e.getMessage();
        return e.getClass().getSimpleName() + (message.isEmpty() ? "" : " \"" + message + "\"");
    }

    private static String stamp() {
        return new SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.ROOT).format(new Date());
    }

    private static synchronized void add(String level, String tag, String message) {
        String line = stamp() + " " + level + " " + tag + " · " + AuthDiag.scrub(message);
        LINES.add(line);
        while (LINES.size() > KEEP) LINES.removeFirst();
        if (file == null) return;
        final File target = file;
        final boolean rewrite = ++fileLines > 2 * KEEP;
        final String chunk = rewrite ? String.join("\n", LINES) + "\n" : line + "\n";
        if (rewrite) fileLines = LINES.size();
        DISK.execute(() -> write(target, chunk, !rewrite));
    }

    private static void write(File target, String text, boolean append) {
        try (FileOutputStream out = new FileOutputStream(target, append)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {
            // The in-memory copy still shows in the dialog.
        }
    }

    /** Written on the crashing thread: the process ends right after. */
    private static void crash(Thread thread, Throwable error) {
        StringBuilder sb = new StringBuilder("crash on ").append(thread.getName()).append(": ").append(describe(error));
        StackTraceElement[] trace = error.getStackTrace();
        for (int i = 0; i < Math.min(8, trace.length); i++) sb.append(" | at ").append(trace[i]);
        if (error.getCause() != null) sb.append(" | caused by ").append(describe(error.getCause()));
        String line = stamp() + " E crash · " + AuthDiag.scrub(sb.toString(), 2000);
        File target;
        synchronized (DiagLog.class) {
            LINES.add(line);
            target = file;
        }
        if (target != null) write(target, line + "\n", true);
    }

    static synchronized void clear() {
        LINES.clear();
        fileLines = 0;
        if (file == null) return;
        final File target = file;
        DISK.execute(() -> write(target, "", false));
    }

    static synchronized boolean empty() {
        return LINES.isEmpty();
    }

    /** What the dialog shows and Copy/Share send: the install's identity, then the lines. */
    static String report(Context context) {
        StringBuilder sb = new StringBuilder();
        for (String h : header(context)) sb.append(h).append('\n');
        sb.append('\n');
        synchronized (DiagLog.class) {
            for (String line : LINES) sb.append(line).append('\n');
        }
        return sb.toString();
    }

    static List<String> header(Context c) {
        List<String> out = new ArrayList<>();
        String version = "?";
        long code = 0;
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            version = pi.versionName;
            code = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
        } catch (Exception ignored) {
        }
        out.add("Verimots " + version + " (" + code + ") · built " + BuildConfig.BUILD_TIME);
        out.add("Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ") · "
                + Build.MANUFACTURER + " " + Build.MODEL);
        out.add("Installed by: " + installer(c));
        String sha1 = signer(c, "SHA-1");
        out.add("Signing certificate SHA-1: " + sha1 + (AuthDiag.releaseSigned(sha1)
                ? " (Verimots release key)" : " (not the Verimots release key; Google Play signing?)"));
        out.add("Signing certificate SHA-256: " + signer(c, "SHA-256"));
        out.add("Google Play services: " + playServices(c));
        out.add("Account: " + (Session.loggedIn(c) ? "Google" : Session.isGuest(c) ? "guest" : "none"));
        return out;
    }

    static String installer(Context c) {
        try {
            String pkg = c.getPackageName();
            PackageManager pm = c.getPackageManager();
            String by = Build.VERSION.SDK_INT >= 30
                    ? pm.getInstallSourceInfo(pkg).getInstallingPackageName()
                    : pm.getInstallerPackageName(pkg);
            if (by == null) return "unknown (adb or a downloaded file)";
            return "com.android.vending".equals(by) ? "Google Play (com.android.vending)" : by;
        } catch (Exception e) {
            return "?";
        }
    }

    static String signer(Context c, String algorithm) {
        try {
            PackageManager pm = c.getPackageManager();
            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= 28) {
                PackageInfo pi = pm.getPackageInfo(c.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                signatures = pi.signingInfo == null ? null : pi.signingInfo.getApkContentsSigners();
            } else {
                PackageInfo pi = pm.getPackageInfo(c.getPackageName(), PackageManager.GET_SIGNATURES);
                signatures = pi.signatures;
            }
            if (signatures == null || signatures.length == 0) return "?";
            return AuthDiag.fingerprint(MessageDigest.getInstance(algorithm).digest(signatures[0].toByteArray()));
        } catch (Exception e) {
            return "?";
        }
    }

    private static String playServices(Context c) {
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo("com.google.android.gms", 0);
            return pi.versionName;
        } catch (Exception e) {
            return "not found";
        }
    }
}
