/**
 * Deeplink travel-date repair (flights).
 *
 * WHY THIS EXISTS (owner 2 Nov: "results yaha abhi v ... kas bata raha hai jb ki maine
 * 19-11-2026 search kiya") — the row DATE is already gated by server/search/travelDateGate,
 * but the EXIT LINK is a separate string that the partner minted for a DIFFERENT day. Live
 * proof: a 19 Nov FlightNetwork search returned rows whose `shareableUrl` was
 *
 *   https://in.flightnetwork.com/from/sharedurl/air/IDRDEL03NOV/1/-/-/c:Y
 *     ?selectionKey=6E6627-03Nov26-R%2C...
 *
 * i.e. the path carries `IDRDEL03NOV` and the selectionKey carries `03Nov26`. The user taps
 * "Book", the partner honours its own URL and shows 3 Nov fares. So the exit is repaired here,
 * from the request, before it is shown.
 *
 * Etraveli format (verified live 2 Nov against in.flightnetwork.com / in.gotogate.com):
 *   /from/sharedurl/air/<FROM><TO><DD><MON>/<pax>/<cabin>/<cabin2>/c:Y?selectionKey=<FLIGHT>-<DD><Mon><YY>-<opaque>
 *
 * The repair is deliberately CONSERVATIVE:
 *  - the path date is rewritten to the requested day (that is what the partner page reads),
 *  - when the selectionKey's date disagrees, the whole selectionKey is DROPPED instead of
 *    edited: the key is a signed-ish itinerary token, and a hand-edited key can resolve to
 *    nothing. Without it the shared URL still opens the ORIGINAL search results for the right
 *    date, which is honest and keeps the paid exit working.
 *  - URLs with no recognisable date token are returned untouched (never invent a date into a
 *    link we do not understand).
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function monOf(dateIso: string): { dd: string; mon: string; yy: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso || '').trim());
  if (!m) return null;
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) return null;
  return { dd: m[3], mon: MONTHS[mm - 1], yy: m[1].slice(2) };
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Repair an Etraveli (FlightNetwork / Gotogate) shared deeplink so it opens the REQUESTED
 * departure day. Returns the original string when the link already agrees (or carries no
 * date at all), so callers can use it unconditionally.
 */
export function repairEtraveliDeeplink(
  shareableUrl: string,
  opts: { fromCode: string; toCode: string; dateIso: string },
): string {
  const raw = String(shareableUrl || '');
  if (!raw) return raw;
  const want = monOf(opts.dateIso);
  if (!want) return raw;
  const from = String(opts.fromCode || '').toUpperCase();
  const to = String(opts.toCode || '').toUpperCase();

  // 1) path date: /<FROM><TO><DD><MON>/
  const pathRe = new RegExp(`/${esc(from)}${esc(to)}(\\d{2})(${MONTHS.join('|')})`, 'i');
  const pathHit = pathRe.exec(raw);
  let out = raw;

  if (pathHit) {
    const samePathDay = pathHit[1] === want.dd && pathHit[2].toUpperCase() === want.mon;
    // 2) selectionKey carries its own "<FLIGHT>-<DD><Mon><YY>-" date
    const keyRe = new RegExp(`([?&])selectionKey=([^&]*)`, 'i');
    const keyHit = keyRe.exec(out);
    let sameKeyDay = true;
    if (keyHit) {
      const key = decodeURIComponent(keyHit[2]);
      const m = /-(\d{2})([A-Za-z]{3})(\d{2})-/.exec(key);
      if (m) sameKeyDay = m[1] === want.dd && m[2].toUpperCase() === want.mon && m[3] === want.yy;
    }
    if (samePathDay && sameKeyDay) return raw; // already correct

    out = out.replace(pathRe, `/${from}${to}${want.dd}${want.mon}`);
    // A stale selectionKey points at the OLD day's itinerary: drop it rather than edit a token
    // we cannot re-sign. The shared URL alone still opens the right date's results.
    if (keyHit && !sameKeyDay) {
      out = out.replace(keyRe, '').replace(/[?&]+$/, '').replace(/\?&/, '?');
    }
    return out;
  }

  // No path token (some brands hand a bare /rf/result style link): leave it alone.
  return raw;
}
