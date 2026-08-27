import { mediaUrl } from '../../utils/media.js';
import type { UserRow } from '../../db/schema.js';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: string;
  rollNumber: string | null;
  department: string | null;
  graduationYear: number | null;
  headline: string;
  bio: string;
  interests: string[];
  avatarUrl: string | null;
  createdAt: Date;
}

type UserLike = Partial<UserRow> & { id: number };

/** The single place a user is serialised, so the password hash cannot leak by accident. */
export function toPublicUser(user: UserLike, interests: string[] = []): PublicUser {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'student',
    rollNumber: user.rollNumber ?? null,
    department: user.department ?? null,
    graduationYear: user.graduationYear ?? null,
    headline: user.headline ?? '',
    bio: user.bio ?? '',
    interests,
    avatarUrl: mediaUrl(user.avatarPath),
    createdAt: user.createdAt ?? new Date(),
  };
}

export interface UserSummary {
  id: number;
  name: string;
  role: string;
  headline: string;
  department: string | null;
  graduationYear: number | null;
  avatarUrl: string | null;
}

/** Trimmed shape used when a user appears as an author or a row in a list. */
export function toUserSummary(user: Partial<UserRow> | null | undefined): UserSummary | null {
  if (!user?.id) return null;
  return {
    id: user.id,
    name: user.name ?? '',
    role: user.role ?? 'student',
    headline: user.headline ?? '',
    department: user.department ?? null,
    graduationYear: user.graduationYear ?? null,
    avatarUrl: mediaUrl(user.avatarPath),
  };
}

/** Columns selected whenever a user is joined in as an author. */
export const authorColumns = {
  id: 'id',
  name: 'name',
  role: 'role',
  headline: 'headline',
  department: 'department',
  graduationYear: 'graduation_year',
  avatarPath: 'avatar_path',
} as const;
