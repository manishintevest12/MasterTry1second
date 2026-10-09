/**
 * RewardsEngine — Spin & Earn (Section 18). Every rule is enforced with transactions,
 * unique constraints and idempotency keys — duplicate requests, concurrent spins,
 * retries and multiple tabs cannot double-award.
 *
 * VALID REFERRAL → +1 POINT → 100 VALID POINTS → ONE SPIN ELIGIBILITY →
 * BACKEND-DECIDED SPIN → ADMIN-CONFIGURED PRIZE → USER-ONLY RESULT → MANUAL ADMIN FULFILMENT
 *
 * No cashback wallet. No cashback withdrawal. No points-to-cash conversion.
 */
import crypto from 'crypto';
import { getStore } from '../common/db';
import { log } from '../common/logger';

const POINTS_PER_VALID_REFERRAL = 1;
const POINTS_PER_SPIN_ELIGIBILITY = 100;

/**
 * Per-user async mutex: serializes eligibility claims and spins within the process.
 * On MySQL the unique constraints are the final guard; this removes avoidable races
 * (and is REQUIRED for correctness on the single-process dev file store).
 */
const userLocks = new Map<number, Promise<unknown>>();
async function withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) || Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  userLocks.set(userId, run.catch(() => undefined));
  try {
    return await run;
  } finally {
    if (userLocks.get(userId) === run) userLocks.delete(userId);
  }
}

// ---------------- Referrals & points ----------------

/** Register a referral. A referee can only ever be referred once. */
export async function registerReferral(referrerId: number, refereeId: number): Promise<{ ok: boolean; error?: string; awarded?: boolean }> {
  if (referrerId === refereeId) return { ok: false, error: 'Cannot refer yourself' };
  const store = getStore();
  return store.transaction(async (tx) => {
    // Referee must not already have a referrer
    const existing: any[] = await (tx.query as any)('SELECT id FROM referrals WHERE referee_id = ?', [refereeId]);
    if (existing.length > 0) return { ok: false, error: 'This user was already referred' };
    const res = await tx.execute('INSERT INTO referrals (referrer_id, referee_id, status) VALUES (?, ?, ?)', [referrerId, refereeId, 'pending']);
    const referralId = (res as any).insertId || 0;
    // Mark valid immediately at signup (points are one-per-referral, idempotent via unique constraint)
    await tx.execute('UPDATE referrals SET status = ?, validated_at = NOW() WHERE id = ?', ['valid', referralId]);
    try {
      await tx.execute('INSERT INTO referral_point_events (user_id, referral_id, points) VALUES (?, ?, ?)', [referrerId, referralId, POINTS_PER_VALID_REFERRAL]);
    } catch (e: any) {
      if (String(e).includes('unique') || String(e).includes('Duplicate')) {
        return { ok: true, awarded: false }; // idempotent — point already awarded for this referral
      }
      throw e;
    }
    return { ok: true, awarded: true };
  });
}

export async function validPointBalance(userId: number): Promise<number> {
  const store = getStore();
  const rows: any[] = await (store.query as any)('SELECT points FROM referral_point_events WHERE user_id = ?', [userId]);
  return rows.reduce((sum, r) => sum + Number(r.points || 0), 0);
}

// ---------------- Spin eligibility ----------------

/**
 * Convert 100 valid points into one spin eligibility. Runs inside a transaction with
 * re-read of the point sum, so concurrent requests cannot create two eligibilities
 * from the same points, and no eligibility is created below 100 points.
 */
export async function claimSpinEligibility(userId: number): Promise<{ ok: boolean; eligibilityId?: number; error?: string }> {
  const store = getStore();
  return withUserLock(userId, () => store.transaction(async (tx) => {
    const rows: any[] = await (tx.query as any)('SELECT points FROM referral_point_events WHERE user_id = ?', [userId]);
    const points = rows.reduce((sum: number, r: any) => sum + Number(r.points || 0), 0);
    const consumed = await consumedPoints(userId, tx);
    const available = points - consumed;
    if (available < POINTS_PER_SPIN_ELIGIBILITY) {
      return { ok: false, error: `Need ${POINTS_PER_SPIN_ELIGIBILITY} valid points; ${available} available` };
    }
    const res = await tx.execute('INSERT INTO spin_eligibilities (user_id) VALUES (?)', [userId]);
    return { ok: true, eligibilityId: (res as any).insertId || undefined };
  }));
}

async function consumedPoints(userId: number, tx: any): Promise<number> {
  // Points already consumed by eligibilities = 100 × number of eligibilities
  const rows: any[] = await (tx.query as any)('SELECT id FROM spin_eligibilities WHERE user_id = ?', [userId]);
  return rows.length * POINTS_PER_SPIN_ELIGIBILITY;
}

export async function eligibleSpinCount(userId: number): Promise<number> {
  const store = getStore();
  const rows: any[] = await (store.query as any)(
    'SELECT id FROM spin_eligibilities WHERE user_id = ? AND consumed_at IS NULL', [userId],
  );
  return rows.length;
}

// ---------------- The spin itself ----------------

export interface SpinOutcome {
  status: 'SPINNED' | 'DUPLICATE' | 'NO_ELIGIBILITY' | 'NO_PRIZES' | 'ERROR';
  spinId?: number;
  prize?: { id: number; name: string; description?: string } | null;
}

/**
 * Execute a spin. Atomic in one transaction:
 *  - re-checks an unconsumed eligibility and consumes it (SELECT ... FOR UPDATE semantics
 *    via unique constraint uq_spin_eligibility)
 *  - the backend draws the prize from admin-configured, in-inventory prizes (weighted)
 *  - the client can NEVER select its own prize or spin twice on one eligibility
 *  - idempotency key makes duplicate/retry/multi-tab requests return the same result
 */
export async function executeSpin(userId: number, idempotencyKey?: string): Promise<SpinOutcome> {
  const store = getStore();
  const key = idempotencyKey || crypto.randomUUID(); // per-eligibility spin idempotency

  // Idempotent replay: same user + same key returns the recorded outcome
  const prior = await store.query<any>('SELECT id, prize_id FROM spins WHERE user_id = ? AND idempotency_key = ?', [userId, key]);
  if (prior.length > 0) {
    const prize = await prizeFor(Number(prior[0].prize_id));
    return { status: 'DUPLICATE', spinId: Number(prior[0].id), prize };
  }

  return withUserLock(userId, () => store.transaction(async (tx) => {
    // 1. Claim an unconsumed eligibility atomically
    const elig: any[] = await (tx.query as any)(
      'SELECT id FROM spin_eligibilities WHERE user_id = ? AND consumed_at IS NULL ORDER BY id LIMIT 1', [userId],
    );
    if (elig.length === 0) return { status: 'NO_ELIGIBILITY' as const };
    const eligibilityId = Number(elig[0].id);

    // 2. Admin-configured prizes with remaining inventory (weighted draw, backend-decided)
    const activePrizes: any[] = await (tx.query as any)('SELECT id, name, description, weight, active FROM prizes');
    const inventory: any[] = await (tx.query as any)('SELECT prize_id, quantity FROM prize_inventory');
    const invByPrize = new Map(inventory.map((i: any) => [Number(i.prize_id), Number(i.quantity)]));
    const prizes: any[] = activePrizes
      .filter((p: any) => Number(p.active) === 1 && (invByPrize.get(Number(p.id)) ?? 0) > 0)
      .map((p: any) => ({ ...p, quantity: invByPrize.get(Number(p.id)) }));
    if (prizes.length === 0) {
      // No prizes configured → eligibility is NOT consumed
      return { status: 'NO_PRIZES' as const };
    }

    // 3. Insert spin first (unique constraints protect against races)
    let spinRes;
    try {
      spinRes = await tx.execute(
        'INSERT INTO spins (user_id, eligibility_id, prize_id, idempotency_key) VALUES (?, ?, NULL, ?)',
        [userId, eligibilityId, key],
      );
    } catch (e: any) {
      // Race: another concurrent spin consumed this eligibility or replayed the key
      const replay: any[] = await (tx.query as any)('SELECT id, prize_id FROM spins WHERE user_id = ? AND idempotency_key = ?', [userId, key]);
      if (replay.length > 0) {
        const prize = await prizeForTx(tx, Number(replay[0].prize_id));
        return { status: 'DUPLICATE' as const, spinId: Number(replay[0].id), prize };
      }
      log.warn('Rewards', 'Spin race rejected by constraint', { error: String(e).slice(0, 120) });
      return { status: 'NO_ELIGIBILITY' as const };
    }
    const spinId = (spinRes as any).insertId || 0;

    // 4. Weighted draw among available prizes
    const totalWeight = prizes.reduce((s: number, p: any) => s + Number(p.weight), 0);
    let roll = Math.random() * totalWeight;
    let chosen = prizes[0];
    for (const p of prizes) {
      roll -= Number(p.weight);
      if (roll <= 0) { chosen = p; break; }
    }

    // 5. Decrement inventory atomically, never below zero
    const dec = await tx.execute('UPDATE prize_inventory SET quantity = quantity - 1 WHERE prize_id = ? AND quantity > 0', [chosen.id]);
    if ((dec as any).affectedRows === 0) {
      throw new Error('PRIZE_SOLD_OUT'); // transaction rolls back → eligibility preserved, spin not recorded
    }

    // 6. Record the final prize + consume eligibility + open fulfilment record
    await tx.execute('UPDATE spins SET prize_id = ? WHERE id = ?', [chosen.id, spinId]);
    await tx.execute('UPDATE spin_eligibilities SET consumed_at = NOW() WHERE id = ?', [eligibilityId]);
    await tx.execute('INSERT INTO fulfilment_records (spin_id, user_id, prize_id, status) VALUES (?, ?, ?, ?)', [spinId, userId, chosen.id, 'PENDING']);

    return {
      status: 'SPINNED' as const,
      spinId,
      prize: { id: Number(chosen.id), name: chosen.name, description: chosen.description || undefined },
    };
  })).catch(async (err: any) => {
    if (String(err.message).includes('PRIZE_SOLD_OUT')) return { status: 'NO_PRIZES' as const };
    log.error('Rewards', 'Spin failed', { error: String(err).slice(0, 150) });
    return { status: 'ERROR' as const };
  });
}

async function prizeForTx(tx: any, prizeId: number | null) {
  if (!prizeId) return null;
  const rows: any[] = await (tx.query as any)('SELECT id, name, description FROM prizes WHERE id = ?', [prizeId]);
  return rows.length ? { id: Number(rows[0].id), name: rows[0].name, description: rows[0].description || undefined } : null;
}

async function prizeFor(prizeId: number | null) {
  if (!prizeId) return null;
  const rows = await getStore().query<any>('SELECT id, name, description FROM prizes WHERE id = ?', [prizeId]);
  return rows.length ? { id: Number(rows[0].id), name: rows[0].name, description: rows[0].description || undefined } : null;
}

// ---------------- Spin result privacy ----------------

/** Spin results are private to the authenticated owner (object-level authorization). */
export async function getSpinResult(userId: number, spinId: number): Promise<{ status: 'OK' | 'NOT_FOUND' | 'FORBIDDEN'; prize?: any }> {
  const rows = await getStore().query<any>('SELECT id, user_id, prize_id FROM spins WHERE id = ?', [spinId]);
  if (rows.length === 0) return { status: 'NOT_FOUND' };
  if (Number(rows[0].user_id) !== userId) return { status: 'FORBIDDEN' };
  const prize = await prizeFor(rows[0].prize_id ? Number(rows[0].prize_id) : null);
  return { status: 'OK', prize };
}

// ---------------- Fulfilment (Section 18 privacy) ----------------

/**
 * Collect ONLY the required fulfilment info: name, phone, current location.
 * Stored against the authenticated owner's spin; admin-only access thereafter.
 */
export async function submitFulfilmentDetails(userId: number, spinId: number, contact: { name: string; phone: string; location: string }): Promise<{ ok: boolean; error?: string }> {
  if (!contact.name?.trim() || !/^\+?\d[\d\s-]{7,14}$/.test(contact.phone || '')) {
    return { ok: false, error: 'Valid name and phone are required for prize fulfilment' };
  }
  const store = getStore();
  const rows: any[] = await (store.query as any)('SELECT id, user_id FROM spins WHERE id = ?', [spinId]);
  if (rows.length === 0) return { ok: false, error: 'Spin not found' };
  if (Number(rows[0].user_id) !== userId) return { ok: false, error: 'This spin belongs to another user' };
  try {
    const res = await store.execute(
      `UPDATE fulfilment_records SET contact_name = ?, contact_phone = ?, contact_location = ?, status = ?
       WHERE spin_id = ? AND user_id = ?`,
      [contact.name.trim().slice(0, 160), contact.phone.trim().slice(0, 30), (contact.location || '').trim().slice(0, 500), 'CONTACT_REQUIRED', spinId, userId],
    );
    if ((res as any).affectedRows === 0) return { ok: false, error: 'No fulfilment record for this spin' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: 'Fulfilment update failed' };
  }
}

export async function listFulfilmentsForAdmin(): Promise<any[]> {
  return getStore().query(
    `SELECT f.id, f.spin_id, f.user_id, f.status, f.contact_name, f.contact_phone, f.contact_location, f.created_at,
            p.name AS prize_name
     FROM fulfilment_records f JOIN spins s ON s.id = f.spin_id LEFT JOIN prizes p ON p.id = f.prize_id
     ORDER BY f.created_at DESC LIMIT 200`,
  );
}

export async function updateFulfilmentStatus(recordId: number, status: string): Promise<boolean> {
  const allowed = ['PENDING', 'CONTACT_REQUIRED', 'APPROVED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'];
  if (!allowed.includes(status)) return false;
  const res = await getStore().execute('UPDATE fulfilment_records SET status = ? WHERE id = ?', [status, recordId]);
  return (res as any).affectedRows > 0;
}
