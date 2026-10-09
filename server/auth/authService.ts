/**
 * Auth (Section 19 prerequisites): scrypt password hashing, DB-backed sessions,
 * admin role check, and object-level authorization helpers for private endpoints.
 * No external crypto deps — node:crypto only.
 */
import crypto from 'crypto';
import { settings } from '../common/settings';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../types';
import { getStore } from '../common/db';

export const SESSION_TTL_SEC = 30 * 24 * 3600;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const candidate = crypto.scryptSync(password, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function registerUser(email: string, password: string, displayName?: string): Promise<{ ok: boolean; userId?: number; error?: string }> {
  if (!email || !password || password.length < 8) return { ok: false, error: 'Email and a password of at least 8 characters are required' };
  const store = getStore();
  const existing = await store.query<any>('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing.length > 0) return { ok: false, error: 'An account with this email already exists' };
  // Bootstrap: the configured ADMIN_EMAIL account is granted the admin role on registration.
  const role = settings.adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
  const res = await store.execute(
    'INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
    [email.toLowerCase(), hashPassword(password), displayName || null, role],
  );
  return { ok: true, userId: res.insertId || undefined };
}

export async function loginUser(email: string, password: string): Promise<{ ok: boolean; token?: string; user?: AuthUser; error?: string }> {
  const store = getStore();
  const rows = await store.query<any>('SELECT id, email, password_hash, display_name, role FROM users WHERE email = ?', [email.toLowerCase()]);
  if (rows.length === 0) return { ok: false, error: 'Invalid credentials' };
  const row = rows[0];
  if (!verifyPassword(password, row.password_hash)) return { ok: false, error: 'Invalid credentials' };
  const token = crypto.randomBytes(32).toString('hex');
  await store.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [
    token, Number(row.id), new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString().slice(0, 19).replace('T', ' '),
  ]);
  return {
    ok: true,
    token,
    user: { id: Number(row.id), email: row.email, role: row.role, displayName: row.display_name || undefined },
  };
}

export async function userForToken(token?: string): Promise<AuthUser | null> {
  if (!token) return null;
  const store = getStore();
  // Two simple lookups (no JOIN) so the dev file store and MySQL behave identically.
  const sess = await store.query<any>(`SELECT user_id, expires_at FROM sessions WHERE id = ?`, [token]);
  if (sess.length === 0) return null;
  const exp = String(sess[0].expires_at || '').replace('T', ' ').slice(0, 19);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (!exp || exp <= now) return null; // expired — lexicographic 'YYYY-MM-DD HH:MM:SS' comparison
  const rows = await store.query<any>(`SELECT id, email, display_name, role FROM users WHERE id = ?`, [Number(sess[0].user_id)]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: Number(r.id), email: r.email, role: r.role, displayName: r.display_name || undefined };
}

// ============ Express middleware ============
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '') || (req as any).session?.token;
  const user = await userForToken(token);
  (req as any).user = user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) return res.status(401).json({ success: false, error: 'Authentication required' });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthUser | null;
  if (!user || user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin authorization required' });
  next();
}

/** Object-level authorization: a user may only touch their own private resources. */
export function requireOwnership(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthUser | null;
  const targetId = Number(req.params.userId || req.body.userId);
  if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (user.role !== 'admin' && targetId && targetId !== user.id) {
    return res.status(403).json({ success: false, error: 'You can only access your own resources' });
  }
  next();
}
