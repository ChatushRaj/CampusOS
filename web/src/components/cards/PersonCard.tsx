import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { identityChip } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import type { PersonRow } from '@/types';

export function PersonCard({ person }: { person: PersonRow }) {
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['people'] });
    queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
    // A person you just connected with should drop out of the suggestions list.
    queryClient.invalidateQueries({ queryKey: ['people-suggestions'] });
  };

  const request = useMutation({
    mutationFn: () => api.post(`/api/connections/${person.id}/request`),
    onSuccess: () => {
      toast.success(`Request sent to ${person.name}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accept = useMutation({
    mutationFn: (id: number) => api.post(`/api/connections/${id}/accept`),
    onSuccess: () => {
      toast.success(`You are now connected with ${person.name}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/connections/${id}`),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const chip = identityChip(person);
  const link = person.connection;

  return (
    <Card interactive className="flex flex-col">
      <CardBody className="flex flex-1 flex-col items-center pt-5 text-center">
        <Link to={`/app/people/${person.id}`} className="rounded-full">
          <Avatar name={person.name} src={person.avatarUrl} size="lg" />
        </Link>

        <h3 className="mt-3 font-display text-base font-semibold text-ink">
          <Link to={`/app/people/${person.id}`} className="hover:underline">
            {person.name}
          </Link>
        </h3>

        {person.role !== 'student' && (
          <Badge tone="primary" className="mt-1.5 capitalize">
            {person.role}
          </Badge>
        )}

        {chip && <p className="mt-1.5 font-mono text-xs text-ink-subtle">{chip}</p>}
        {person.headline && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{person.headline}</p>}

        <div className="mt-4 w-full">
          {!link && (
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              loading={request.isPending}
              onClick={() => request.mutate()}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Connect
            </Button>
          )}

          {link?.status === 'pending' && link.direction === 'outgoing' && (
            <Button size="sm" variant="ghost" className="w-full" onClick={() => remove.mutate(link.id)}>
              <Clock className="h-4 w-4" aria-hidden />
              Request sent
            </Button>
          )}

          {link?.status === 'pending' && link.direction === 'incoming' && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" loading={accept.isPending} onClick={() => accept.mutate(link.id)}>
                <Check className="h-4 w-4" aria-hidden />
                Accept
              </Button>
              <Button size="sm" variant="ghost" aria-label="Decline request" onClick={() => remove.mutate(link.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {link?.status === 'accepted' && (
            <Button size="sm" variant="ghost" className="w-full text-primary" onClick={() => remove.mutate(link.id)}>
              <Check className="h-4 w-4" aria-hidden />
              Connected
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
