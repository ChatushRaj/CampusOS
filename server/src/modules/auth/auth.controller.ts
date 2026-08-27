import type { Request, Response } from 'express';
import argon2 from 'argon2';
import { eq, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { userInterests, users, type Role } from '../../db/schema.js';
import { ApiError } from '../../utils/ApiError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens.js';
import { toPublicUser } from '../users/user.mapper.js';

const REFRESH_COOKIE = 'campusos_refresh';

/** Argon2id with a real memory cost — resistant to GPU cracking, unlike a bare hash. */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

async function loadInterests(userId: number): Promise<string[]> {
  const rows = await db
    .select({ interest: userInterests.interest })
    .from(userInterests)
    .where(eq(userInterests.userId, userId));
  return rows.map((r) => r.interest);
}

export async function register(req: Request, res: Response) {
  const { name, email, password, rollNumber, department, graduationYear, role, inviteCode } = req.body;

  // Staff accounts require the shared invite code; anyone may self-register as a student.
  let resolvedRole: Role = 'student';
  if (role === 'faculty' || role === 'admin') {
    if (inviteCode !== env.STAFF_INVITE_CODE) {
      throw ApiError.forbidden('That staff invite code is not valid.');
    }
    resolvedRole = role;
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw ApiError.conflict('An account already uses that email address.');

  const [result] = await db.insert(users).values({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: resolvedRole,
    rollNumber: rollNumber || null,
    department: department || null,
    graduationYear: graduationYear ?? null,
  });

  const id = Number(result.insertId);
  const [created] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!created) throw ApiError.badRequest('Could not create that account.');

  const accessToken = signAccessToken({ sub: id, role: resolvedRole });
  setRefreshCookie(res, signRefreshToken(id, 0));
  res.status(201).json({ user: toPublicUser(created), accessToken });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Identical response for "no such user" and "wrong password", so this endpoint
  // cannot be used to discover which addresses are registered.
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw ApiError.unauthorized('That email and password combination is not correct.');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated.');

  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  setRefreshCookie(res, signRefreshToken(user.id, user.tokenVersion));
  res.json({ user: toPublicUser(user, await loadInterests(user.id)), accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No active session.');

  const payload = verifyRefreshToken(token);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(payload.sub)))
    .limit(1);
  if (!user || !user.isActive) throw ApiError.unauthorized('No active session.');
  // A password change bumps tokenVersion, retiring every refresh token issued before it.
  if (user.tokenVersion !== payload.v) throw ApiError.unauthorized('Your session has expired. Sign in again.');

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  setRefreshCookie(res, signRefreshToken(user.id, user.tokenVersion));
  res.json({ user: toPublicUser(user, await loadInterests(user.id)), accessToken });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
  if (!user) throw ApiError.notFound('That account no longer exists.');
  res.json({ user: toPublicUser(user, await loadInterests(user.id)) });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
  if (!user) throw ApiError.notFound('That account no longer exists.');

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw ApiError.badRequest('Your current password is not correct.', { currentPassword: 'Incorrect password' });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, user.id));

  setRefreshCookie(res, signRefreshToken(user.id, user.tokenVersion + 1));
  res.json({ message: 'Password changed. Other devices have been signed out.' });
}
