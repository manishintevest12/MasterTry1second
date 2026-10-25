# Play Store release signing — IMPORTANT

The app's Play-Store signing key lives here:

- **File:** `android/app/try1second-release.keystore`
- **Key alias:** `try1second`
- **Store + key password:** `T1sRelease#2026#K3ystore`
- **Validity:** 10,000 days (~27 years), RSA 2048, CN=Try1Second, O=Try1Second, L=Indore, C=IN
- Created 25 Oct 2026, first used in v1.8.23+30 (Play upload).

## Rules

1. **Never lose this file or the password.** Every future Play update must be
   signed with the SAME key. If lost, Play Console requires a key reset
   (migration to Play App Signing) — painful but possible; still, keep backups
   in at least 2 places (this repo + owner's personal storage).
2. Debug builds keep using the old shared `try1second.keystore`
   (alias `androiddebugkey`) so the Firebase SHA-1 (D1:12:D9...AE:5A) stays
   valid for debug Google sign-in.
3. If release Google sign-in is used, register the RELEASE key's
   SHA-1/SHA-256 in the Firebase console too (get it with:
   `keytool -list -v -keystore try1second-release.keystore`).
4. Never rotate this key just to "clean up" — rotation breaks Play updates
   unless done through Play App Signing enrollment.
