import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Card } from './Card';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/** Mirrors the shape of the real card so the layout does not jump when data lands. */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[85%]" />
            <Skeleton className="h-3 w-[60%]" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-[70%]" />
          <Skeleton className="h-8 w-24 mt-2" />
        </Card>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

/** An empty screen is an invitation to act, not a dead end. */
export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-danger/25 bg-danger-soft px-6 py-12 text-center"
    >
      <AlertTriangle className="mb-3 h-6 w-6 text-danger" aria-hidden />
      <h3 className="font-display text-base font-semibold text-ink">That did not load</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        {message ?? 'Something went wrong while fetching this. Try again in a moment.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}
