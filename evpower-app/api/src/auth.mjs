import { randomBytes, randomUUID, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const id = () => randomUUID();
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return salt + ':' + hash.toString('hex');
}
export async function passwordMatches(password, encoded) {
  const [salt, hash] = encoded.split(':');
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function safeUser(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone,
    role: row.role, emailVerified: !!row.email_verified, createdAt: row.created_at };
}
export function issueSession(db, user, now, family = id()) {
  const accessToken = token(), refreshToken = token();
  const at = new Date(now()).toISOString();
  db.prepare('INSERT INTO sessions(id,user_id,family,access_hash,refresh_hash,access_expires,refresh_expires,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(id(), user.id, family, digest(accessToken), digest(refreshToken),
      new Date(now() + 15 * 60_000).toISOString(), new Date(now() + 30 * 86400_000).toISOString(), at);
  return { accessToken, refreshToken, user: safeUser(user) };
}
