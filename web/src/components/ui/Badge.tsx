import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-border/50 text-ink-muted',
      primary: 'bg-primary-soft text-primary',
      accent: 'bg-accent-soft text-accent',
      danger: 'bg-danger-soft text-danger',
      success: 'bg-success-soft text-success',
      outline: 'border border-border text-ink-muted',
    },
    size: {
      sm: 'px-2 py-0.5 text-[0.6875rem]',
      md: 'px-2.5 py-1 text-xs',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'sm' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone, size }), className)} {...props} />;
}
