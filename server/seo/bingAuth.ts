/**
 * BING WEBMASTER TOOLS SITE VERIFICATION.
 *
 * OWNER 9 Nov: "bing webmaster tools mai site add kr do aap hi". Bing asks for proof of ownership as
 * either a meta tag or this XML file at the site root, and it must be served byte for byte: the SPA
 * catch-all answers every unknown path with the HTML shell, which fails the check. Registering the exact
 * path before the static handler makes the file reachable without touching the SPA.
 *
 * The token is public by design (it only proves we control the host), so it lives in source, the same way
 * the IndexNow key and the Google verification file do.
 */
export const BING_AUTH_PATH = '/BingSiteAuth.xml';

/** Verbatim contents of the file Bing issued for try1second.com. Do not reformat: Bing compares the text. */
export const BING_AUTH_XML = `<?xml version="1.0"?>
<users>
\t<user>E811B25A024009A953C73041CF399A5E</user>
</users>
`;

/** Minimal shape of the express app we need, kept local so this file stays dependency-free. */
interface GetCapableApp {
  get(path: string, handler: (req: unknown, res: any) => void): void;
}

export function registerBingAuthRoutes(app: GetCapableApp): void {
  app.get(BING_AUTH_PATH, (_req, res) => {
    res.type('application/xml; charset=utf-8').setHeader('Cache-Control', 'public, max-age=86400');
    res.send(BING_AUTH_XML);
  });
}
