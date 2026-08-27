import { db } from '../db/index.js';
import { notifications, type Role } from '../db/schema.js';
import { logger } from '../config/logger.js';

type NotificationType = typeof notifications.$inferInsert.type;

interface NotifyInput {
  recipientId: number;
  actorId?: number | null;
  type: NotificationType;
  message: string;
  link?: string | null;
}

/**
 * Fire and forget: a failed notification must never fail the action that caused it.
 * Self-directed notifications are dropped — nobody needs telling they liked their own post.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (input.actorId && input.actorId === input.recipientId) return;
    await db.insert(notifications).values({
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      message: input.message,
      link: input.link ?? null,
    });
  } catch (err) {
    logger.warn({ err }, 'Could not create notification');
  }
}

export async function notifyMany(recipientIds: number[], base: Omit<NotifyInput, 'recipientId'>): Promise<void> {
  try {
    const rows = recipientIds
      .filter((id) => !base.actorId || id !== base.actorId)
      .map((recipientId) => ({
        recipientId,
        actorId: base.actorId ?? null,
        type: base.type,
        message: base.message,
        link: base.link ?? null,
      }));
    if (rows.length) await db.insert(notifications).values(rows);
  } catch (err) {
    logger.warn({ err }, 'Could not create notifications');
  }
}

export type { Role };
