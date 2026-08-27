import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin, MoreHorizontal, Star, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { eventWhen } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/Modal';
import type { CampusEvent } from '@/types';

export function EventCard({ event }: { event: CampusEvent }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/events/${event.id}`),
    onSuccess: () => {
      toast.success('Event removed');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Could not remove that event.'),
  });

  const rsvp = useMutation({
    mutationFn: (status: 'going' | 'interested' | null) =>
      api.post<{ myRsvp: string | null }>(`/api/events/${event.id}/rsvp`, { status }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        data.myRsvp === 'going'
          ? 'You are going'
          : data.myRsvp === 'interested'
            ? 'Marked as interested'
            : 'RSVP withdrawn',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const full = event.capacity != null && event.goingCount >= event.capacity && event.myRsvp !== 'going';

  return (
    <>
      <Card kind="event" as="article" interactive className="flex flex-col pl-1">
        {event.coverUrl && (
          <img
            src={event.coverUrl}
            alt=""
            loading="lazy"
            className="h-36 w-full rounded-t-lg border-b border-border object-cover"
          />
        )}
        <CardBody className="flex-1 pt-4">
          <div className="flex items-start justify-between gap-2">
            <Badge tone="accent" className="capitalize">
              {event.category}
            </Badge>
            {full && <Badge tone="danger">At capacity</Badge>}
            {event.canManage && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto -mr-1 -mt-1" aria-label="Event options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem destructive onSelect={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Remove event
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
          </div>

          <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink">{event.title}</h3>

          <dl className="mt-2.5 space-y-1.5 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <dt className="sr-only">When</dt>
              <CalendarDays className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <dd className="font-medium text-ink">{eventWhen(event.startsAt)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Where</dt>
              <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <dd className="truncate">{event.venue}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Attendance</dt>
              <Users className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <dd className="tabular-nums">
                {event.goingCount} going
                {event.capacity ? ` of ${event.capacity}` : ''} · {event.interestedCount} interested
              </dd>
            </div>
          </dl>

          {event.description && (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-muted">{event.description}</p>
          )}
        </CardBody>

        <CardFooter className="gap-2 px-3 py-2.5">
          <Button
            size="sm"
            variant={event.myRsvp === 'going' ? 'primary' : 'secondary'}
            className="flex-1"
            loading={rsvp.isPending}
            disabled={full}
            aria-pressed={event.myRsvp === 'going'}
            onClick={() => rsvp.mutate('going')}
          >
            {event.myRsvp === 'going' ? 'Going' : 'Going?'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(event.myRsvp === 'interested' && 'text-accent')}
            aria-pressed={event.myRsvp === 'interested'}
            onClick={() => rsvp.mutate('interested')}
          >
            <Star className={cn('h-4 w-4', event.myRsvp === 'interested' && 'fill-current')} aria-hidden />
            Interested
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this event?"
        message="It disappears from the calendar for everyone, along with every RSVP."
        confirmLabel="Remove event"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
