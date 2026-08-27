import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/Modal';
import type { Poll } from '@/types';

export function PollCard({ poll }: { poll: Poll }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/polls/${poll.id}`),
    onSuccess: () => {
      toast.success('Poll removed');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: () => toast.error('Could not remove that poll.'),
  });

  const vote = useMutation({
    mutationFn: (optionId: number) => api.post(`/api/polls/${poll.id}/vote`, { optionId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  // Results stay hidden until you commit an answer, so early votes do not anchor later ones.
  const showResults = Boolean(poll.myVote) || poll.isClosed;

  return (
    <>
      <Card kind="poll" as="article" className="pl-1">
        <CardBody className="pt-4">
          <div className="flex items-center gap-2">
            <p className="eyebrow">Poll</p>
            {poll.isClosed && <Badge tone="neutral">Closed</Badge>}
            {poll.canManage && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto -mr-1" aria-label="Poll options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem destructive onSelect={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Remove poll
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
          </div>

          <h3 className="mt-2 font-display text-base font-semibold leading-snug text-ink">{poll.question}</h3>

          <div className="mt-3 space-y-2" role="group" aria-label={poll.question}>
            {poll.options.map((option) => {
              const chosen = poll.myVote === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={poll.isClosed || vote.isPending}
                  aria-pressed={chosen}
                  onClick={() => vote.mutate(option.id)}
                  className={cn(
                    'relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    chosen
                      ? 'border-primary bg-primary-soft font-medium text-primary'
                      : 'border-border hover:border-ink-subtle/50',
                    (poll.isClosed || vote.isPending) && 'cursor-default',
                  )}
                >
                  {showResults && (
                    <span
                      className={cn(
                        'absolute inset-y-0 left-0 transition-[width] duration-500',
                        chosen ? 'bg-primary/15' : 'bg-border/50',
                      )}
                      style={{ width: `${option.percentage}%` }}
                      aria-hidden
                    />
                  )}
                  <span className="relative flex items-center justify-between gap-3">
                    <span>{option.label}</span>
                    {showResults && (
                      <span className="shrink-0 tabular-nums text-xs text-ink-muted">{option.percentage}%</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-ink-subtle">
            {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
            {!showResults && ' · pick an option to see results'} · asked by {poll.author.name} {timeAgo(poll.createdAt)}
          </p>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this poll?"
        message="The question and every vote cast on it are deleted."
        confirmLabel="Remove poll"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
