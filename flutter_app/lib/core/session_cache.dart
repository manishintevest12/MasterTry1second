/// Owner 23 Oct: the homepage and Quick Apps load ONCE per app session.
///
/// MainShell switches tabs via `KeyedSubtree(key: ValueKey(tab))`, so every
/// return to the Home tab used to rebuild HomeScreen/QuickAppsScreen from
/// scratch and refetch every section (quick apps, showcase, movies rail) —
/// the app felt slow after any vertical change. This cache lives for the
/// whole process: a hit is instant (no spinner frame), and it dies with the
/// process, so a fresh app start reloads everything exactly as before.
/// Failures are never cached — a failed fetch retries on the next visit.
library;

class SessionCache {
  static final Map<String, Object> _bag = {};

  static bool has(String key) => _bag.containsKey(key);

  static T get<T>(String key, T fallback) => (_bag[key] as T?) ?? fallback;

  static void put(String key, Object value) => _bag[key] = value;

  /// Returns the cached result instantly when present; otherwise awaits
  /// [fetch] and stores its value on success (never on throw).
  static Future<T> once<T extends Object>(String key, Future<T> Function() fetch) async {
    if (_bag.containsKey(key)) return _bag[key] as T;
    final v = await fetch();
    if (v is Object) _bag[key] = v;
    return v;
  }
}
