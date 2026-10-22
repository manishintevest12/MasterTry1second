import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

/// OPTIONAL build-time override: `--dart-define=GOOGLE_SERVER_CLIENT_ID=xxxx.apps.googleusercontent.com`.
/// When empty we pass null to the plugin, and the Android plugin falls back to
/// default_web_client_id from google-services.json (same Google Cloud project as
/// the site's Firebase login) — so sign-in works in every plain build, no
/// dart-define needed. The resulting ID-token audience is whitelisted server-side.
const String kGoogleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

enum AuthStatus { unknown, signedOut, signedIn }

/// App-wide auth state. Google ID token -> Try1Second backend -> session token.
class AuthService extends ChangeNotifier {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const _kToken = 't1sSessionToken';
  static const _kUser = 't1sSessionUser';

  AuthStatus status = AuthStatus.unknown;
  AuthSession? session;
  String? error;
  bool busy = false;
  bool _googleReady = false;

  bool get signedIn => status == AuthStatus.signedIn && session != null;
  AuthUser? get user => session?.user;
  String? get token => session?.token;

  /// Restores a saved session and re-validates it against the backend.
  Future<void> restore(Try1SecondApi api) async {
    final p = await SharedPreferences.getInstance();
    final token = p.getString(_kToken);
    final raw = p.getString(_kUser);
    if (token == null || raw == null) {
      status = AuthStatus.signedOut;
      notifyListeners();
      return;
    }
    try {
      final cached = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      session = AuthSession(token, cached);
      status = AuthStatus.signedIn;
      notifyListeners();
      final fresh = await api.me(token); // validates the session is still alive
      session = AuthSession(token, AuthUser(
        id: fresh.id, email: fresh.email, role: fresh.role,
        displayName: fresh.displayName ?? cached.displayName, picture: cached.picture,
      ));
      notifyListeners();
    } catch (e) {
      final msg = '$e';
      // Only a rejected session logs the user out; being offline keeps the cached profile.
      if (msg.contains('401') || msg.contains('Session') || msg.contains('Unauthor')) {
        await _clear();
      }
    }
  }

  Future<bool> signInWithGoogle(Try1SecondApi api) async {
    if (busy) return false;
    error = null;
    busy = true;
    notifyListeners();
    try {
      if (!_googleReady) {
        // Empty define -> null -> plugin uses default_web_client_id from google-services.json.
        await GoogleSignIn.instance.initialize(
          serverClientId: kGoogleServerClientId.isNotEmpty ? kGoogleServerClientId : null,
        );
        _googleReady = true;
      }
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) throw Exception('Google did not return an ID token');
      final s = await api.loginWithGoogle(idToken);
      await _save(s);
      session = s;
      status = AuthStatus.signedIn;
      return true;
    } on GoogleSignInException catch (e) {
      error = e.code == GoogleSignInExceptionCode.canceled
          ? 'Sign-in was cancelled.'
          : 'Google sign-in failed. Please try again.';
      return false;
    } catch (e) {
      error = '$e'.replaceFirst('Exception: ', '');
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    try {
      if (_googleReady) await GoogleSignIn.instance.signOut();
    } catch (_) {/* best effort */}
    await _clear();
  }

  Future<void> _save(AuthSession s) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kToken, s.token);
    await p.setString(_kUser, jsonEncode(s.user.toJson()));
  }

  Future<void> _clear() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_kToken);
    await p.remove(_kUser);
    session = null;
    status = AuthStatus.signedOut;
    notifyListeners();
  }
}
