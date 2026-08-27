import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Clock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { identityChip, shortDate } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { PostCard } from '@/components/cards/PostCard';
import type { CurrentUser, Paginated, Post } from '@/types';

interface ProfilePayload {
  user: CurrentUser;
  stats: { posts: number; blogs: number; connections: number };
  connection: { id: number; status: 'pending' | 'accepted'; direction: 'outgoing' | 'incoming' } | null;
  isSelf: boolean;
}

export function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.get<ProfilePayload>(`/api/users/${id}`),
    enabled: Boolean(id),
  });

  useDocumentTitle(data?.user.name ?? 'Profile');

  const posts = useQuery({
    queryKey: ['posts', { author: id }],
    queryFn: () => api.get<Paginated<Post>>(`/api/posts?author=${id}&limit=10`),
    enabled: Boolean(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['profile', id] });
    queryClient.invalidateQueries({ queryKey: ['people'] });
  };

  const request = useMutation({
    mutationFn: () => api.post(`/api/connections/${id}/request`),
    onSuccess: () => {
      toast.success('Request sent');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accept = useMutation({
    mutationFn: (connectionId: number) => api.post(`/api/connections/${connectionId}/accept`),
    onSuccess: () => {
      toast.success('Connected');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (connectionId: number) => api.delete(`/api/connections/${connectionId}`),
    onSuccess: refresh,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <CardSkeleton count={2} />
      </div>
    );
  }

  if (isError || !data) return <ErrorState message="We could not find that profile." onRetry={() => refetch()} />;

  const { user, stats, connection, isSelf } = data;
  const chip = identityChip(user);

  return (
    <>
      <Card className="mb-6">
        <CardBody className="pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar name={user.name} src={user.avatarUrl} size="xl" className="mx-auto sm:mx-0" />

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="font-display text-display-sm font-semibold text-ink">{user.name}</h1>
                {user.role !== 'student' && (
                  <Badge tone="primary" size="md" className="capitalize">
                    {user.role}
                  </Badge>
                )}
              </div>

              {user.headline && <p className="mt-1 text-ink-muted">{user.headline}</p>}
              {chip && <p className="mt-1.5 font-mono text-xs text-ink-subtle">{chip}</p>}

              <dl className="mt-4 flex flex-wrap justify-center gap-6 sm:justify-start">
                {[
                  { label: 'Connections', value: stats.connections },
                  { label: 'Posts', value: stats.posts },
                  { label: 'Articles', value: stats.blogs },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dd className="font-display text-lg font-semibold tabular-nums text-ink">{stat.value}</dd>
                    <dt className="eyebrow">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            </div>

            {!isSelf && (
              <div className="shrink-0">
                {!connection && (
                  <Button loading={request.isPending} onClick={() => request.mutate()}>
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Connect
                  </Button>
                )}
                {connection?.status === 'pending' && connection.direction === 'outgoing' && (
                  <Button variant="secondary" onClick={() => remove.mutate(connection.id)}>
                    <Clock className="h-4 w-4" aria-hidden />
                    Request sent
                  </Button>
                )}
                {connection?.status === 'pending' && connection.direction === 'incoming' && (
                  <Button loading={accept.isPending} onClick={() => accept.mutate(connection.id)}>
                    <Check className="h-4 w-4" aria-hidden />
                    Accept request
                  </Button>
                )}
                {connection?.status === 'accepted' && (
                  <Button variant="secondary" onClick={() => remove.mutate(connection.id)}>
                    <Check className="h-4 w-4" aria-hidden />
                    Connected
                  </Button>
                )}
              </div>
            )}
          </div>

          {user.bio && (
            <p className="mt-5 border-t border-border pt-5 text-sm leading-relaxed text-ink-muted">{user.bio}</p>
          )}

          {user.interests.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {user.interests.map((interest) => (
                <li key={interest}>
                  <Badge tone="outline">{interest}</Badge>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-subtle">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Joined {shortDate(user.createdAt)}
          </p>
        </CardBody>
      </Card>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">
        {isSelf ? 'Your posts' : `Posts by ${user.name.split(' ')[0]}`}
      </h2>

      {posts.isLoading && <CardSkeleton count={2} />}
      {posts.data && posts.data.items.length === 0 && (
        <EmptyState
          title="Nothing posted yet"
          message={
            isSelf ? 'Share something from the feed and it shows up here.' : 'This person has not posted publicly.'
          }
        />
      )}
      <div className="space-y-3">
        {posts.data?.items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {isSelf && me && (
        <p className="mt-6 text-center text-sm text-ink-subtle">
          Update your details from{' '}
          <Link to="/app/settings" className="font-medium text-primary hover:underline">
            Settings
          </Link>
          .
        </p>
      )}
    </>
  );
}
