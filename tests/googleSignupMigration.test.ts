import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { splitSqlStatements } from '../server/common/db';

const dir = path.resolve(process.cwd(), 'database', 'migrations');
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

test('google signup: users.password_hash is made nullable by a later migration (001 declares NOT NULL)', () => {
  // The Google routes INSERT password_hash = NULL. 001_init declares it NOT NULL, so without
  // a later ALTER this fails on strict-mode MySQL and the host proxy reports a 503.
  assert.match(read('001_init.sql'), /password_hash VARCHAR\(255\) NOT NULL/);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const fixer = files.find((f) => /MODIFY COLUMN password_hash VARCHAR\(255\) NULL/i.test(read(f)));
  assert.ok(fixer, 'a migration must make password_hash nullable');
  assert.ok(files.indexOf(fixer!) > files.indexOf('001_init.sql'), 'must run after 001_init');
  assert.ok(files.indexOf(fixer!) > files.indexOf('003_firebase_auth.sql'), 'must run after the firebase_uid migration');
});

test('google signup: the nullable-password migration is a single valid executable statement', () => {
  const stmts = splitSqlStatements(read('015_users_passwordless.sql'));
  assert.equal(stmts.length, 1);
  // The splitter keeps leading comment lines with the statement; strip them before matching.
  const sql = stmts[0].split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim();
  assert.match(sql, /^ALTER TABLE users MODIFY COLUMN password_hash VARCHAR\(255\) NULL/i);
});
