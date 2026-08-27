import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Menu, MenuContent, MenuTrigger } from '@/components/ui/Menu';
import type { AppNotification, Paginated } from '@/types';
import { cn } from '@/lib/utils';

type Feed = Paginated<AppNotification> & { unreadCount: number };

export function NotificationsMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Feed>('/api/notifications?limit=8'),
    // Cheap poll keeps the badge roughly current without a socket connection.
    refetchInterval: 60_000,
  });

  const markAll = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unreadCount ?? 0;

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="h-[1.125rem] w-[1.125rem]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold text-danger-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="font-display text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="link" size="sm" className="text-xs" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {!data?.items.length && (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              Nothing yet. Activity on your posts and requests shows up here.
            </p>
          )}
          {data?.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!item.read) markOne.mutate(item.id);
                if (item.link) navigate(item.link);
              }}
              className={cn(
                'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-border/40',
                !item.read && 'bg-primary-soft/40',
              )}
            >
              <Avatar name={item.actor?.name ?? 'C'} src={item.actor?.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  {item.actor && <span className="font-medium">{item.actor.name} </span>}
                  {item.message}
                </span>
                <span className="block text-xs text-ink-subtle">{timeAgo(item.createdAt)}</span>
              </span>
              {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </MenuContent>
    </Menu>
  );
}
