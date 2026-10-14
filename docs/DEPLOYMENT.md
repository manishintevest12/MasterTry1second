# Production Deployment (Hostinger hPanel, shared hosting)

The Node.js app is started by Passenger via **`server.js`**, which runs the
**precompiled `server.cjs` bundle** (never TypeScript sources). `cron.cjs` is the
same deal for the cron warmer. Both are committed to the repo.

## Deploy = `git pull` + Restart. NEVER `npm run build` on the server.

1. In hPanel SSH (app dir): `git pull origin main`
2. Restart the Node.js app in hPanel.

That is all — `dist/` (the web bundle) and `server.cjs` are built in the repo.

## If you ever change backend (`server/`, `server.ts`) or frontend (`src/`)

Rebuild the artifacts BEFORE committing, on your dev machine:

```
npm run build:server   # -> server.cjs (esbuild bundle of server.prod.ts)
npm run build:cron     # -> cron.cjs
npm run build          # -> dist/ (vite; bakes VITE_FIREBASE_* from .env)
```

A `git pull` that only updates `server.ts`/`src/` changes NOTHING in production,
because Passenger runs `server.cjs` and Express serves the committed `dist/`.

## Why `npm run build` on the server breaks Google sign-in

`VITE_FIREBASE_*` values are **build-time** variables baked into `dist/`. The
repo's `.env` (gitignored) has them locally, but the server's `.env` does not.
A server-side `vite build` therefore produces a bundle with NO Firebase config
and the site shows "Google sign-in is not configured yet."

If you must build on the server, first add to the server's `.env`:

```
VITE_FIREBASE_API_KEY=AIzaSyBrq8rPJjSyqeYwGo3sa4fdMuz8o1ykR0U
VITE_FIREBASE_AUTH_DOMAIN=try1second-66273.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=try1second-66273
VITE_FIREBASE_APP_ID=1:49438102645:web:3e5d2c82f7be014e06543
VITE_FIREBASE_MESSAGING_SENDER_ID=49438102645
VITE_FIREBASE_MEASUREMENT_ID=G-RV9M2SNQEF
```

(Firebase web config is public by design; usage is restricted by Firebase rules.)

## If git pull refuses ("local changes would be overwritten")

A server-side build modified tracked files. Restore the committed versions first:

```
git restore dist/
git clean -f dist/assets/
git pull origin main
```

## One-time Firebase Console check

Authentication → Settings → **Authorized domains** must include
`try1second.com` and `www.try1second.com`, or the Google popup closes with an
auth/unauthorized-domain error. Server-side `FIREBASE_PROJECT_ID` must be set in
the hPanel environment (it already is).
