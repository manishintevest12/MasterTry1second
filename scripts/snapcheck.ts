import * as S from '../server/seo/liveSnapshot';
(async () => {
  for (const p of ['/hotels/mumbai', '/movies/noida', '/cabs/noida', '/flights', '/hotels/indore']) {
    try {
      const fn: any = (S as any).pageSnapshot || (S as any).buildPageSnapshot || (S as any).snapshotFor;
      const snap = fn ? await fn(p) : null;
      console.log(p, '->', snap ? JSON.stringify({ rows: snap.rows.length, sample: snap.rows[0], updatedAt: snap.updatedAt }) : 'null');
    } catch (e: any) { console.log(p, 'ERR', e.message); }
  }
})();
