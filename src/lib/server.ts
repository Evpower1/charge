import 'server-only';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, demoMode } from './db';
import type { User } from './types';
export const hashToken = (s: string) => createHash('sha256').update(s).digest('hex');
export const safeUser = (u: Record<string, unknown>): User => ({id: u.id as string, name: u.name as string, email: u.email as string, phone: u.phone as string, role: u.role as string});
export function currentUser(req: NextRequest): User | null {
  const token = req.cookies.get('evpower_session')?.value;
  if (!token) return null;
  const user = db.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?').get(hashToken(token), Date.now());
  return user ? safeUser(user) : null;
}
export function setSession(res: NextResponse, userId: string) {
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hashToken(token), userId, Date.now() + 1000 * 60 * 60 * 24 * 7);
  res.cookies.set('evpower_session', token, { httpOnly: true, secure: process.env.APP_URL?.startsWith('https://') ?? process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, saved: string) {
  const [salt, hash] = saved.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
export function requireAdmin(req: NextRequest) {
  if (currentUser(req)?.role !== 'admin' && !demoMode) throw Object.assign(new Error('Administrator access required.'), { status: 403 });
}
export function rateLimit(key: string, max: number, windowMs = 15 * 60 * 1000) {
  db.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(Date.now());
  const row = db.prepare('SELECT count FROM rate_limits WHERE key = ?').get(key);
  if (row && Number(row.count) >= max) throw Object.assign(new Error('Too many attempts. Please try again in a few minutes.'), { status: 429 });
  db.prepare('INSERT INTO rate_limits VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count = count + 1').run(key, 1, Date.now() + windowMs);
}
export function protectMutation(req: NextRequest) {
  const origin = req.headers.get('origin');
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : req.nextUrl.origin;
  if (!origin || origin !== expected) throw Object.assign(new Error('This request could not be verified. Please refresh the page.'), { status: 403 });
  const length = Number(req.headers.get('content-length') || 0);
  if (length > 32000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
}
export async function readBody(req: NextRequest) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw Object.assign(new Error('JSON form data is required.'), { status: 415 });
  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError('Missing request body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 32000) { await reader.cancel(); throw Object.assign(new Error('Request is too large.'), { status: 413 }); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
