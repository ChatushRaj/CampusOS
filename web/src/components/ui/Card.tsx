import { cn } from '@/lib/utils';

type Kind = 'post' | 'blog' | 'notice' | 'event' | 'job' | 'listing' | 'poll';

const spineColor: Record<Kind, string> = {
  post: 'text-kind-post',
  blog: 'text-kind-blog',
  notice: 'text-kind-notice',
  event: 'text-kind-event',
  job: 'text-kind-job',
  listing: 'text-kind-listing',
  poll: 'text-kind-poll',
};

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Draws the type-keyed hairline down the left edge. */
  kind?: Kind;
  interactive?: boolean;
  as?: 'div' | 'article' | 'li';
}

export function Card({ className, kind, interactive, as: Tag = 'div', ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-border bg-surface shadow-card',
        kind && ['spine', spineColor[kind]],
        interactive && 'transition-[box-shadow,border-color,transform] duration-200 ease-out',
        interactive &&
          'hover:-translate-y-0.5 hover:shadow-raised hover:border-ink-subtle/30 focus-within:shadow-raised focus-within:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 sm:px-5 sm:pb-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-1 border-t border-border px-2 py-1.5', className)} {...props} />;
}
