import { useEffect, useState } from 'react';

export type AppLinkValue = { url: string; version: string | null } | null;
export interface AppLinks {
  chrome_extension: AppLinkValue;
  android_app: AppLinkValue;
  ios_app: AppLinkValue;
}

const EMPTY: AppLinks = { chrome_extension: null, android_app: null, ios_app: null };
let cache: AppLinks | null = null;
let inflight: Promise<AppLinks> | null = null;

/** Loads the admin-configured download links once per page load (GET /api/app-links). */
function fetchAppLinks(): Promise<AppLinks> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/api/app-links')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        cache = d && d.success && d.links ? { ...EMPTY, ...d.links } : EMPTY;
        return cache as AppLinks;
      })
      .catch(() => EMPTY)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useAppLinks(): { links: AppLinks; loaded: boolean } {
  const [links, setLinks] = useState<AppLinks>(cache || EMPTY);
  const [loaded, setLoaded] = useState<boolean>(Boolean(cache));
  useEffect(() => {
    let alive = true;
    fetchAppLinks().then((l) => { if (alive) { setLinks(l); setLoaded(true); } });
    return () => { alive = false; };
  }, []);
  return { links, loaded };
}
