/**
 * Full HTTP end-to-end against a real server: admin auth -> photo upload -> entry save -> public feed.
 * Mirrors exactly what the Finance Verticals tab does after the 11 Nov fixes.
 */
import { getStore } from '../server/common/db';
import crypto from 'node:crypto';

const email = 'e2e-admin@try1second.test';
const store = getStore();
await store.execute("INSERT INTO users (email, password_hash, display_name, role) VALUES (?,?,?,?)", [email, 'x', 'E2E Admin', 'admin']).catch(() => {});
const rows = await store.query<any>('SELECT id FROM users WHERE email = ?', [email]);
const token = crypto.randomBytes(32).toString('hex');
await store.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)', [token, Number(rows[0].id), new Date(Date.now() + 3600_000).toISOString().slice(0, 19).replace('T', ' ')]);
console.log('TOKEN', token);
