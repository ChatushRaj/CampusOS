import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  align = 'end',
  children,
}: {
  className?: string;
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[11rem] overflow-hidden rounded-md border border-border bg-surface p-1 shadow-pop',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 duration-150',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none transition-colors',
        destructive ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-ink data-[highlighted]:bg-border/50',
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 py-1.5 eyebrow">{children}</DropdownMenu.Label>;
}
