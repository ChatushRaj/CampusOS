import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex shrink-0 overflow-hidden rounded-full bg-primary-soft', sizes[size], className)}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="h-full w-full object-cover" />}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center font-medium text-primary"
        delayMs={src ? 300 : 0}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
