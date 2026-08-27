import { NavLink } from 'react-router-dom';
import {
  Bookmark,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Newspaper,
  LifeBuoy,
  ShoppingBag,
  Users,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';
import { cn } from '@/lib/utils';

const links = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/feed', label: 'Feed', icon: MessageSquareText },
  { to: '/app/notices', label: 'Notices', icon: Megaphone },
  { to: '/app/events', label: 'Events', icon: CalendarDays },
  { to: '/app/jobs', label: 'Placements', icon: Briefcase },
  { to: '/app/blogs', label: 'Articles', icon: Newspaper },
  { to: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/app/groups', label: 'Groups', icon: UsersRound },
  { to: '/app/people', label: 'People', icon: Users },
  { to: '/app/bookmarks', label: 'Saved', icon: Bookmark },
  { to: '/app/reports', label: 'Reports', icon: LifeBuoy, roles: ['admin'] as Role[] },
];

interface SidebarProps {
  open: boolean;
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { user } = useAuth();

  return (
    <>
      {/* Scrim only exists on small screens, where the sidebar overlays content. */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-ink/40 backdrop-blur-[1px] transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onNavigate}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out',
          'lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pt-20 lg:pt-4">
          {links
            .filter((link) => !link.roles || (user && link.roles.includes(user.role)))
            .map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-border/40 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
                    {label}
                    {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-border p-3">
          <p className="eyebrow px-3">Signed in as</p>
          <p className="px-3 pt-1 text-sm font-medium capitalize text-ink">{user?.role}</p>
          <p className="px-3 text-xs text-ink-subtle">{user?.department ?? 'No department set'}</p>
        </div>
      </aside>
    </>
  );
}
