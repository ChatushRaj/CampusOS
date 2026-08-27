import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Building2, Check, Clock, MapPin, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { deadlineLabel, stipendRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/Modal';
import type { Job } from '@/types';

export function JobCard({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(job.isBookmarked);
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deadline = deadlineLabel(job.applyBy);

  const bookmark = useMutation({
    mutationFn: () => api.post<{ isBookmarked: boolean }>(`/api/jobs/${job.id}/bookmark`),
    onMutate: () => setSaved((v) => !v),
    onSuccess: (data) => {
      setSaved(data.isBookmarked);
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onError: () => {
      setSaved(job.isBookmarked);
      toast.error('Could not save that role.');
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/jobs/${job.id}`),
    onSuccess: () => {
      toast.success('Opening removed');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Could not remove that opening.'),
  });

  const apply = useMutation({
    mutationFn: () => api.post(`/api/jobs/${job.id}/apply`, {}),
    onSuccess: () => {
      toast.success('Application submitted');
      setApplyOpen(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <Card kind="job" as="article" interactive className="flex flex-col pl-1">
        <CardBody className="flex-1 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary" className="capitalize">
              {job.type}
            </Badge>
            <Badge tone="outline" className="capitalize">
              {job.mode}
            </Badge>
            <Badge tone={deadline.expired ? 'neutral' : deadline.urgent ? 'danger' : 'neutral'} className="ml-auto">
              <Clock className="h-3 w-3" aria-hidden />
              {deadline.text}
            </Badge>
            {job.canManage && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-mr-1" aria-label="Opening options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem destructive onSelect={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Remove opening
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
          </div>

          <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink">
            <Link to={`/app/jobs/${job.id}`} className="hover:underline">
              {job.title}
            </Link>
          </h3>

          <dl className="mt-2 space-y-1.5 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Company</dt>
              <Building2 className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <dd className="truncate font-medium text-ink">{job.company}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Location</dt>
              <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <dd className="truncate">{job.location}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Openings</dt>
              <Users className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <dd className="tabular-nums">
                {job.openings} {job.openings === 1 ? 'opening' : 'openings'} · {job.applicationCount} applied
              </dd>
            </div>
          </dl>

          <p className="mt-3 font-mono text-sm font-medium text-ink">{stipendRange(job.stipendMin, job.stipendMax)}</p>

          {job.skills.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 5).map((skill) => (
                <li key={skill}>
                  <Badge tone="neutral">{skill}</Badge>
                </li>
              ))}
              {job.skills.length > 5 && (
                <li>
                  <Badge tone="outline">+{job.skills.length - 5}</Badge>
                </li>
              )}
            </ul>
          )}
        </CardBody>

        <CardFooter className="gap-2 px-3 py-2.5">
          {job.hasApplied ? (
            <Button size="sm" variant="secondary" className="flex-1" disabled>
              <Check className="h-4 w-4" aria-hidden />
              Applied
            </Button>
          ) : (
            <Button size="sm" className="flex-1" disabled={job.isExpired} onClick={() => setApplyOpen(true)}>
              {job.isExpired ? 'Applications closed' : 'Apply'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={cn(saved && 'text-primary')}
            onClick={() => bookmark.mutate()}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved' : 'Save role'}
          >
            <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden />
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title={`Apply to ${job.title}?`}
        message={`Your profile is shared with ${job.company}. Make sure your headline and department are up to date before applying.`}
        confirmLabel="Submit application"
        loading={apply.isPending}
        onConfirm={() => apply.mutate()}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this opening?"
        message="It is withdrawn from placements, along with every application submitted to it."
        confirmLabel="Remove opening"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
