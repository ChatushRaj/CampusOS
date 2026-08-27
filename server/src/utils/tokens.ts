import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
import type { Role } from '../db/schema.js';

export interface AccessPayload {
  sub: number;
  role: Role;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: 'campusos',
  } as SignOptions);
}

export function signRefreshToken(userId: number, tokenVersion: number): string {
  return jwt.sign({ sub: userId, v: tokenVersion }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
    issuer: 'campusos',
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'campusos' }) as unknown as AccessPayload;
  } catch {
    throw ApiError.unauthorized('Your session has expired. Sign in again.');
  }
}

export function verifyRefreshToken(token: string): { sub: number; v: number } {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'campusos' }) as unknown as { sub: number; v: number };
  } catch {
    throw ApiError.unauthorized('Your session has expired. Sign in again.');
  }
}
