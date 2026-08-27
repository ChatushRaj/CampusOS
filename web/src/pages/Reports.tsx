import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import type { Paginated, UserSummary } from '@/types';

interface Report {
  id: number;
  subject: string;
  body: string;
  category: 'bug' | 'suggestion' | 'content' | 'other';
  status: 'open' | 'in-review' | 'resolved';
  screenshotUrl: string | null;
  user: UserSummary;
  createdAt: string;
}

const STATUSES = ['open', 'in-review', 'resolved'] as const;

const statusTone = { open: 'danger', 'in-review': 'accent', resolved: 'neutral' } as const;

/**
 * Support queue for administrators. The dashboard shows a count of open
 * reports; this is where that number leads.
 */
export function Reports() {
  useDocumentTitle('Reports');
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('open');
  const [page, setPage] = useState(1);

  const reports = useQuery({
    queryKey: ['feedback', status, page],
    queryFn: () => api.get<Paginated<Report>>(`/api/feedback${qs({ status, page })}`),
  });

  const setStatusFor = useMutation({
    mutationFn: ({ id, next }: { id: number; next: string }) => api.patch(`/api/feedback/${id}`, { status: next }),
    onSuccess: () => {
      toast.success('Report updated');
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      // The admin dashboard shows the open count, so it has to move too.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Could not update that report.'),
  });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Bugs and suggestions sent from the support form."
        action={
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All reports</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value === 'in-review' ? 'In review' : value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </Select>
        }
      />

      {reports.isPending && <CardSkeleton count={4} />}
      {reports.isError && <ErrorState onRetry={() => reports.refetch()} />}

      {reports.data && reports.data.items.length === 0 && (
        <EmptyState
          icon={<LifeBuoy className="h-5 w-5" />}
          title="Nothing to review"
          message={status === 'open' ? 'No open reports right now.' : 'No reports match that filter.'}
        />
      )}

      {reports.data && reports.data.items.length > 0 && (
        <div className="stagger space-y-4">
          {reports.data.items.map((report) => (
            <Card key={report.id} kind="notice" as="article" className="pl-1">
              <CardBody className="pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[report.status]}>
                    {report.status === 'in-review' ? 'In review' : report.status}
                  </Badge>
                  <Badge tone="outline" className="capitalize">
                    {report.category}
                  </Badge>
                  <span className="ml-auto text-xs text-ink-subtle">
                    <time dateTime={report.createdAt}>{timeAgo(report.createdAt)}</time>
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink">{report.subject}</h3>

                <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-subtle">
                  <Avatar src={report.user.avatarUrl} name={report.user.name} size="sm" />
                  {report.user.name}
                  {report.user.department && <> · {report.user.department}</>}
                </div>

                <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{report.body}</p>

                {report.screenshotUrl && (
                  <a
                    href={report.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block"
                  >
                    <img
                      src={report.screenshotUrl}
                      alt={`Screenshot attached to ${report.subject}`}
                      loading="lazy"
                      className="max-h-48 rounded-md border border-border object-cover"
                    />
                  </a>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUSES.filter((value) => value !== report.status).map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant="secondary"
                      disabled={setStatusFor.isPending}
                      onClick={() => setStatusFor.mutate({ id: report.id, next: value })}
                    >
                      {value === 'open' ? 'Reopen' : value === 'in-review' ? 'Start review' : 'Mark resolved'}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {reports.data && reports.data.totalPages > 1 && (
        <Pagination
          page={reports.data.page}
          totalPages={reports.data.totalPages}
          total={reports.data.total}
          onChange={setPage}
        />
      )}
    </>
  );
}
