import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, Building2, Check, Clock, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { deadlineLabel, shortDate, stipendRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Avatar';
import type { Job, Paginated, UserSummary } from '@/types';

interface ApplicationRow {
  id: number;
  note: string;
  status: string;
  applicant: UserSummary;
  createdAt: string;
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get<{ job: Job }>(`/api/jobs/${id}`),
    enabled: Boolean(id),
  });

  const job = data?.job;
  useDocumentTitle(job?.title ?? 'Opening');

  // Only the poster (or an admin) may read this, so it is fetched separately.
  const applications = useQuery({
    queryKey: ['job-applications', id],
    queryFn: () => api.get<Paginated<ApplicationRow>>(`/api/jobs/${id}/applications`),
    enabled: Boolean(id) && Boolean(job?.canManage) && can('faculty', 'admin'),
  });

  const apply = useMutation({
    mutationFn: () => api.post(`/api/jobs/${id}/apply`, {}),
    onSuccess: () => {
      toast.success('Application submitted');
      setApplyOpen(false);
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bookmark = useMutation({
    mutationFn: () => api.post<{ isBookmarked: boolean }>(`/api/jobs/${id}/bookmark`),
    onSuccess: (result) => {
      toast.success(result.isBookmarked ? 'Saved to your list' : 'Removed from saved');
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (isError || !job) return <ErrorState message="That opening is no longer listed." onRetry={() => refetch()} />;

  const deadline = deadlineLabel(job.applyBy);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/app/jobs">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All placements
        </Link>
      </Button>

      <Card kind="job" className="pl-1">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary" className="capitalize">
              {job.type}
            </Badge>
            <Badge tone="outline" className="capitalize">
              {job.mode}
            </Badge>
            <Badge tone={deadline.expired ? 'neutral' : deadline.urgent ? 'danger' : 'neutral'}>
              <Clock className="h-3 w-3" aria-hidden />
              {deadline.text}
            </Badge>
          </div>

          <h1 className="mt-3 font-display text-display-sm font-semibold text-ink">{job.title}</h1>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Company</dt>
              <Building2 className="h-4 w-4 text-ink-subtle" aria-hidden />
              <dd className="font-medium text-ink">{job.company}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Location</dt>
              <MapPin className="h-4 w-4 text-ink-subtle" aria-hidden />
              <dd>{job.location}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Openings</dt>
              <Users className="h-4 w-4 text-ink-subtle" aria-hidden />
              <dd className="tabular-nums">
                {job.openings} {job.openings === 1 ? 'opening' : 'openings'} · {job.applicationCount} applied
              </dd>
            </div>
          </dl>

          <p className="mt-3 font-mono text-base font-medium text-ink">
            {stipendRange(job.stipendMin, job.stipendMax)}
          </p>
          <p className="mt-1 text-xs text-ink-subtle">
            Applications close {shortDate(job.applyBy)}
            {job.startsOn && ` · starts ${shortDate(job.startsOn)}`}
            {job.durationMonths ? ` · ${job.durationMonths} months` : ''}
          </p>
        </CardHeader>

        <CardBody className="pt-0">
          <div className="flex flex-wrap gap-2 border-y border-border py-3">
            {job.hasApplied ? (
              <Button variant="secondary" disabled>
                <Check className="h-4 w-4" aria-hidden />
                Applied
              </Button>
            ) : (
              <Button disabled={job.isExpired} onClick={() => setApplyOpen(true)}>
                {job.isExpired ? 'Applications closed' : 'Apply for this role'}
              </Button>
            )}
            <Button
              variant="ghost"
              className={cn(job.isBookmarked && 'text-primary')}
              onClick={() => bookmark.mutate()}
              aria-pressed={job.isBookmarked}
            >
              <Bookmark className={cn('h-4 w-4', job.isBookmarked && 'fill-current')} aria-hidden />
              {job.isBookmarked ? 'Saved' : 'Save'}
            </Button>
          </div>

          <section className="mt-5">
            <h2 className="font-display text-base font-semibold text-ink">About the role</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">
              {job.description
                .split('\n')
                .filter((p) => p.trim())
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
            </div>
          </section>

          {job.companyAbout && (
            <section className="mt-5">
              <h2 className="font-display text-base font-semibold text-ink">About {job.company}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{job.companyAbout}</p>
            </section>
          )}

          {job.skills.length > 0 && (
            <section className="mt-5">
              <h2 className="font-display text-base font-semibold text-ink">Skills</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <li key={skill}>
                    <Badge tone="neutral" size="md">
                      {skill}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-6 text-xs text-ink-subtle">Posted by {job.postedBy.name}</p>
        </CardBody>
      </Card>

      {job.canManage && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            Applications ({applications.data?.total ?? job.applicationCount})
          </h2>
          {applications.data && applications.data.items.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-ink-muted">
              Nobody has applied yet.
            </p>
          )}
          <ul className="space-y-2">
            {applications.data?.items.map((row) => (
              <li key={row.id}>
                <Card>
                  <CardBody className="flex items-start gap-3 pt-4">
                    <Avatar name={row.applicant.name} src={row.applicant.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/app/people/${row.applicant.id}`}
                        className="text-sm font-medium text-ink hover:underline"
                      >
                        {row.applicant.name}
                      </Link>
                      <p className="text-xs text-ink-subtle">
                        {row.applicant.department ?? 'No department'} · applied {shortDate(row.createdAt)}
                      </p>
                      {row.note && <p className="mt-1.5 text-sm text-ink-muted">{row.note}</p>}
                    </div>
                    <Badge tone="outline" className="capitalize">
                      {row.status}
                    </Badge>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title={`Apply to ${job.title}?`}
        message={`Your profile is shared with ${job.company}. Make sure your headline and department are up to date before applying.`}
        confirmLabel="Submit application"
        loading={apply.isPending}
        onConfirm={() => apply.mutate()}
      />
    </>
  );
}
