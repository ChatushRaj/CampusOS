import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu as MenuIcon, Moon, Settings, Sun, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { Logo } from './Logo';
import { Sidebar } from './Sidebar';
import { SearchBar } from './SearchBar';
import { NotificationsMenu } from './NotificationsMenu';

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // A route change should never leave the mobile drawer hanging open.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 h-16 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1400px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>

          <Link to="/app" className="shrink-0 rounded-sm">
            <Logo className="hidden sm:inline-flex" />
            <Logo className="sm:hidden" showWordmark={false} />
          </Link>

          <div className="ml-auto flex flex-1 justify-end lg:ml-6 lg:justify-start">
            <div className="hidden w-full max-w-md md:block">
              <SearchBar />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <Sun className="h-[1.125rem] w-[1.125rem]" />
              ) : (
                <Moon className="h-[1.125rem] w-[1.125rem]" />
              )}
            </Button>
            <NotificationsMenu />

            <Menu>
              <MenuTrigger asChild>
                <button
                  className="ml-1 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  <Avatar name={user?.name ?? ''} src={user?.avatarUrl} size="sm" />
                </button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>{user?.email}</MenuLabel>
                <MenuSeparator />
                <MenuItem onSelect={() => navigate(`/app/people/${user?.id}`)}>
                  <UserIcon className="h-4 w-4" />
                  Your profile
                </MenuItem>
                <MenuItem onSelect={() => navigate('/app/settings')}>
                  <Settings className="h-4 w-4" />
                  Settings
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  destructive
                  onSelect={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Keyed by path so the transition replays on every navigation. */}
          <div key={location.pathname} className="mx-auto max-w-5xl animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
