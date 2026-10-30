#!/usr/bin/env node
/**
 * OWNER 30 Oct: the apex host try1second.com must answer
 * /.well-known/assetlinks.json with 200 -- Android's App Links verifier rejects a redirect.
 *
 * Live probe found what actually happens there: requests to the apex are 301-ed onto www,
 * EXCEPT real files that exist in the static document root (/ads.txt, /favicon.ico,
 * /google<id>.html all answer 200 on the apex while /api/* and any unknown path 301).
 * So the one thing we can do from our side is make the verification files REAL static
 * files: they are emitted into public/.well-known/ and copied into dist/ by the build, so
 * the apex serves them itself instead of bouncing to www.
 *
 * Single source of truth: this script and the Express routes both read
 * server/marketing/appLinkVerify.ts, so the fingerprints can never drift apart.
 *
 * Usage: node scripts/gen-applink-static.mjs   (wired into `npm run build`)
 */
import { mkdirSync, writeFileSync } from 'node:fs';

// Run under tsx (`node --import tsx scripts/gen-applink-static.mjs`) so the TypeScript
// module below loads directly; that keeps ONE implementation shared with the routes.
const { assetLinksJson, appleAppSiteAssociation } = await import('../server/marketing/appLinkVerify.ts');

const dir = 'public/.well-known';
mkdirSync(dir, { recursive: true });

const assetlinks = `${JSON.stringify(assetLinksJson(), null, 2)}\n`;
writeFileSync(`${dir}/assetlinks.json`, assetlinks);

// iOS: only written when IOS_TEAM_ID is configured. Without it there is no appID to
// declare, and a fake file would make iOS reject the domain outright.
const aasa = appleAppSiteAssociation();
if (aasa) {
  writeFileSync(`${dir}/apple-app-site-association`, `${JSON.stringify(aasa, null, 2)}\n`);
  console.log(`[applinks] wrote ${dir}/assetlinks.json + apple-app-site-association`);
} else {
  console.log(`[applinks] wrote ${dir}/assetlinks.json (iOS skipped: IOS_TEAM_ID not set)`);
}
