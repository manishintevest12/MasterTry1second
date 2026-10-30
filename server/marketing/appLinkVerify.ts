/**
 * APP-LINK VERIFICATION FILES (owner 29 Oct: "universal link khule to app me khule,
 * browser me nahi").
 *
 * Android only trusts an App Link after it fetches, over HTTPS with no redirects,
 *   https://<host>/.well-known/assetlinks.json
 * and finds our package name with a matching signing-certificate SHA-256. iOS does the
 * same with /.well-known/apple-app-site-association.
 *
 * Why an explicit route instead of a file in dist/: express.static ignores dot
 * directories by default, so `/.well-known/...` would 404 even with the file on disk.
 * This route answers it directly, for BOTH hosts (www and apex) and with the
 * `application/json` content type the verifiers require.
 *
 * FINGERPRINTS — the app is signed by two keys, so both must be listed:
 *   • release key  (android/app/try1second-release.keystore, alias try1second)
 *       BC:22:41:42:7D:5B:43:B8:51:9F:AE:A3:81:33:45:CA:A3:9E:D6:05:8A:65:38:46:43:85:8D:C8:DC:F1:5C:DE
 *   • debug/shared key (android/app/try1second.keystore, alias androiddebugkey) — the
 *     Committed shared keystore every local/CI build uses, so a test APK also verifies
 *       45:9E:B5:8E:8F:71:B0:94:26:59:E5:17:96:C1:54:06:F9:D0:98:F5:64:2E:15:89:A2:23:6B:67:58:30:A7:C5
 *
 * PLAY APP SIGNING: an app installed from the Play Store is re-signed by Google, so its
 * certificate is NEITHER of the above. Add Play's SHA-256 with the env var
 * ANDROID_PLAY_SHA256 (comma-separated for several) — Play Console -> Setup -> App
 * integrity -> App signing key certificate. Without it, links verify for the APK
 * installed directly but Play installs open the browser.
 *
 * iOS: the AASA file needs the Apple Team ID, which only the owner's Apple account has,
 * so it is served only once IOS_TEAM_ID (+ optional IOS_BUNDLE_ID) is configured; until
 * then a 404 is returned instead of a file iOS would reject.
 */

export const ANDROID_PACKAGE = 'com.try1second.try1second';

const RELEASE_SHA256 = 'BC:22:41:42:7D:5B:43:B8:51:9F:AE:A3:81:33:45:CA:A3:9E:D6:05:8A:65:38:46:43:85:8D:C8:DC:F1:5C:DE';
const DEBUG_SHA256 = '45:9E:B5:8E:8F:71:B0:94:26:59:E5:17:96:C1:54:06:F9:D0:98:F5:64:2E:15:89:A2:23:6B:67:58:30:A7:C5';

/** Extra fingerprints from the environment (Play App Signing certificate). */
function extraFingerprints(): string[] {
  return String(process.env.ANDROID_PLAY_SHA256 || '')
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x));
}

export function fingerprintList(): string[] {
  // Deduplicated: the env var is meant for Play's APP SIGNING certificate, but the
  // upload key's SHA-256 is what Play Console shows first, and pasting that just
  // repeats the release key already listed. A duplicate is harmless to Android but
  // it hides the fact that the Play certificate is still missing, so it is dropped.
  return [...new Set([RELEASE_SHA256, DEBUG_SHA256, ...extraFingerprints()])];
}

/** The exact JSON Android's verifier expects. */
export function assetLinksJson(): Array<Record<string, unknown>> {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprintList(),
      },
    },
  ];
}

/** iOS AASA, or null while the owner's Apple Team ID is not configured. */
export function appleAppSiteAssociation(): Record<string, unknown> | null {
  const team = String(process.env.IOS_TEAM_ID || '').trim();
  if (!team) return null;
  const bundle = String(process.env.IOS_BUNDLE_ID || ANDROID_PACKAGE).trim();
  const appId = `${team}.${bundle}`;
  const paths = ['/'];
  return {
    applinks: {
      apps: [] as string[],
      details: [{ appID: appId, paths }],
      // Universal Links 2.0 shape for iOS 13+; both shapes are read by iOS.
      components: [{ '/': '/*', comment: 'every Try1Second path opens the app' }],
    },
    // Deep-link the app's own scheme when iOS passes a link through Safari fallback.
    webcredentials: { apps: [appId] },
  };
}

/** Register the two verification routes on the root Express app. */
export function registerAppLinkRoutes(app: {
  get: (path: string, handler: (req: any, res: any) => void) => void;
}): void {
  app.get('/.well-known/assetlinks.json', (_req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    // Verification is re-run on install/update, so a short cache is enough; a change of
    // fingerprint must reach Google quickly.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(JSON.stringify(assetLinksJson(), null, 2));
  });

  app.get('/.well-known/apple-app-site-association', (_req: any, res: any) => {
    const aasa = appleAppSiteAssociation();
    if (!aasa) {
      // Not configured yet: answer honestly instead of serving a file iOS would reject.
      res.status(404).setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ error: 'iOS universal links need IOS_TEAM_ID to be configured' }));
      return;
    }
    // AASA must be served as application/json with NO redirect and no .json suffix.
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(JSON.stringify(aasa, null, 2));
  });
}
