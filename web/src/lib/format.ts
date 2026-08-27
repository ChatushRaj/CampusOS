import { format, formatDistanceToNowStrict, isPast, isToday, isTomorrow } from 'date-fns';

export function timeAgo(value: string | Date): string {
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function shortDate(value: string | Date): string {
  return format(new Date(value), 'd MMM yyyy');
}

export function dateTime(value: string | Date): string {
  return format(new Date(value), "d MMM yyyy 'at' h:mm a");
}

/** Puts the date first, because that is what people scan for. */
export function eventWhen(value: string | Date): string {
  const date = new Date(value);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`;
  return format(date, 'EEE d MMM, h:mm a');
}

export function deadlineLabel(value: string | Date): { text: string; urgent: boolean; expired: boolean } {
  const date = new Date(value);
  if (isPast(date)) return { text: 'Closed', urgent: false, expired: true };
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  return {
    text: days <= 1 ? 'Closes today' : `${days} days left`,
    urgent: days <= 3,
    expired: false,
  };
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function money(value: number | null | undefined): string {
  if (value == null) return '—';
  return inr.format(value);
}

export function stipendRange(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return 'Not disclosed';
  if (min != null && max != null) return `${money(min)} – ${money(max)}`;
  return money(min ?? max);
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Builds the mono identity chip: CS · 2026 · B1042 */
export function identityChip(user: {
  department?: string | null;
  graduationYear?: number | null;
  rollNumber?: string | null;
}): string | null {
  const parts = [
    user.department
      ? user.department
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 3)
      : null,
    user.graduationYear ? String(user.graduationYear) : null,
    user.rollNumber ? user.rollNumber.slice(-5) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
