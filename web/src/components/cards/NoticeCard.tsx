import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, MoreHorizontal, Pin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { shortDate, timeAgo } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/Modal';
import type { Notice } from '@/types';

const priorityTone = { urgent: 'danger', important: 'accent', normal: 'neutral' } as const;

export function NoticeCard({ notice }: { notice: Notice }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/notices/${notice.id}`),
    onSuccess: () => {
      toast.success('Notice removed');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: () => toast.error('Could not remove that notice.'),
  });

  const isLong = notice.body.length > 240;

  return (
    <>
      <Card kind="notice" as="article" interactive className="pl-1">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {notice.pinned && (
              <Badge tone="primary">
                <Pin className="h-3 w-3" aria-hidden />
                Pinned
              </Badge>
            )}
            <Badge tone={priorityTone[notice.priority]} className="capitalize">
              {notice.priority}
            </Badge>
            <Badge tone="outline" className="capitalize">
              {notice.category}
            </Badge>

            {notice.canManage && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto" aria-label="Notice options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem destructive onSelect={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Remove notice
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
          </div>

          <h3 className="mt-2.5 font-display text-lg font-semibold leading-snug text-ink">{notice.title}</h3>
          <p className="mt-1 text-xs text-ink-subtle">
            {notice.postedBy.name} · <time dateTime={notice.createdAt}>{timeAgo(notice.createdAt)}</time>
            {notice.expiresAt && <> · Valid until {shortDate(notice.expiresAt)}</>}
          </p>
        </CardHeader>

        <CardBody className="pt-0">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
            {isLong && !expanded ? `${notice.body.slice(0, 240)}…` : notice.body}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {isLong && (
              <Button variant="link" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show less' : 'Read full notice'}
              </Button>
            )}
            {notice.attachmentUrl && (
              <a
                href={notice.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Open attachment
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this notice?"
        message="It disappears from the board for everyone immediately."
        confirmLabel="Remove notice"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
