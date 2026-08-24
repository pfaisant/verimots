# Verimots R8 rules.
# The app is a single activity with no reflection of its own; the only
# reflection-sensitive area is Google sign-in via androidx.credentials +
# the Google ID token library (their consumer rules cover most of it).

# Google Identity Services / Credential Manager
-keep class com.google.android.libraries.identity.googleid.** { *; }
-dontwarn com.google.android.libraries.identity.googleid.**

# Credential Manager pulls in Play Services classes resolved at runtime
-dontwarn com.google.android.gms.**

# Keep line numbers so Play Console crash traces stay readable
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
