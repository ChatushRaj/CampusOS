import { cn } from '@/lib/utils';

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-primary" />
        <rect x="8" y="8" width="3" height="16" rx="1.5" fill="currentColor" className="text-primary-foreground" />
        <rect
          x="14"
          y="8"
          width="10"
          height="3"
          rx="1.5"
          fill="currentColor"
          className="text-primary-foreground"
          opacity=".9"
        />
        <rect
          x="14"
          y="14.5"
          width="10"
          height="3"
          rx="1.5"
          fill="currentColor"
          className="text-primary-foreground"
          opacity=".65"
        />
        <rect
          x="14"
          y="21"
          width="6"
          height="3"
          rx="1.5"
          fill="currentColor"
          className="text-primary-foreground"
          opacity=".45"
        />
      </svg>
      {showWordmark && <span className="font-display text-lg font-semibold tracking-tight text-ink">CampusOS</span>}
      <span className="sr-only">CampusOS home</span>
    </span>
  );
}
