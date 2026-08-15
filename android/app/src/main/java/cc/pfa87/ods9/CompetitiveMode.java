package cc.pfa87.ods9;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;
import java.util.concurrent.Executors;

final class CompetitiveMode {
    static final String WEB_CLIENT_ID =
            "617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com";

    private final Activity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private String currentTrailId;

    CompetitiveMode(Activity activity) {
        this.activity = activity;
        RemoteApi.setSessionToken(Session.token(activity));
    }

    boolean loggedIn() {
        return Session.loggedIn(activity);
    }

    String userName() {
        return Session.name(activity);
    }

    void signIn(Runnable onSuccess) {
        try {
            CredentialManager mgr = CredentialManager.create(activity);
            GetGoogleIdOption opt = new GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(WEB_CLIENT_ID)
                    .setAutoSelectEnabled(true)
                    .setNonce(UUID.randomUUID().toString())
                    .build();
            GetCredentialRequest req = new GetCredentialRequest.Builder()
                    .addCredentialOption(opt)
                    .build();
            mgr.getCredentialAsync(
                    activity,
                    req,
                    null,
                    Executors.newSingleThreadExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            handleResult(result, onSuccess);
                        }

                        @Override
                        public void onError(GetCredentialException e) {
                            ui.post(() -> Toast.makeText(activity, "Connexion Google annulée", Toast.LENGTH_SHORT).show());
                        }
                    });
        } catch (Exception e) {
            Toast.makeText(activity, "Connexion Google indisponible", Toast.LENGTH_SHORT).show();
        }
    }

    void signOut() {
        Session.clear(activity);
        RemoteApi.setSessionToken("");
    }

    private void handleResult(GetCredentialResponse result, Runnable onSuccess) {
        try {
            Credential cred = result.getCredential();
            GoogleIdTokenCredential google;
            if (cred instanceof GoogleIdTokenCredential) {
                google = (GoogleIdTokenCredential) cred;
            } else {
                google = GoogleIdTokenCredential.createFrom(cred.getData());
            }
            String idToken = google.getIdToken();
            RemoteApi.authGoogle(idToken, new RemoteApi.AuthCb() {
                @Override
                public void ok(JSONObject user, String sessionToken) {
                    Session.save(activity, sessionToken, user);
                    Toast.makeText(activity, "Connecté · " + user.optString("name"), Toast.LENGTH_SHORT).show();
                    if (onSuccess != null) onSuccess.run();
                }

                @Override
                public void error(String message) {
                    Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
                }
            });
        } catch (Exception e) {
            ui.post(() -> Toast.makeText(activity, "Jeton Google invalide", Toast.LENGTH_SHORT).show());
        }
    }

    void fetchTrail(TrailCallback callback) {
        RemoteApi.fetchTrail(new RemoteApi.TrailCb() {
            @Override
            public void ok(String trailId, String category, String rack) {
                currentTrailId = trailId;
                callback.onTrail(trailId, category, rack);
            }

            @Override
            public void error(String message) {
                callback.onError(message);
            }
        });
    }

    void fetchBoard(LinearLayout boardContainer, TextView boardTitle) {
        RemoteApi.fetchBoard(currentTrailId, new RemoteApi.BoardCb() {
            @Override
            public void ok(JSONArray top, JSONObject me) {
                paintBoard(boardContainer, boardTitle, top, me);
            }

            @Override
            public void error(String message) {
                if (boardContainer != null) boardContainer.setVisibility(android.view.View.GONE);
            }
        });
    }

    private void paintBoard(LinearLayout container, TextView title, JSONArray top, JSONObject me) {
        if (container == null) return;
        if (top == null || top.length() == 0) {
            container.setVisibility(android.view.View.GONE);
            return;
        }
        container.setVisibility(android.view.View.VISIBLE);
        if (title != null) title.setText("Classement du jour");
        container.removeAllViews();
        if (title != null) container.addView(title);
        for (int i = 0; i < Math.min(10, top.length()); i++) {
            try {
                JSONObject entry = top.getJSONObject(i);
                TextView row = new TextView(activity);
                row.setText(entry.optInt("rank", i + 1) + ".  " + entry.optString("pseudo", "?") + "  " + entry.optInt("percent") + "%");
                row.setTextColor(0xFFF7F2E8);
                row.setPadding(12, 10, 12, 10);
                container.addView(row);
            } catch (Exception ignored) {
            }
        }
    }

    void submitScore(int percent, String word) {
        if (!loggedIn()) return;
        RemoteApi.compete(percent, word, new RemoteApi.CompeteCb() {
            @Override
            public void ok() {
                Toast.makeText(activity, "Score classé", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void alreadySubmitted() {
                Toast.makeText(activity, "Déjà classé aujourd'hui", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void error(String message) {
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    interface TrailCallback {
        void onTrail(String trailId, String category, String rack);

        void onError(String message);
    }
}
