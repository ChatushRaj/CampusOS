import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { compactNumber, eventWhen, shortDate, timeAgo } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { PageHeader } from '@/components/layout/PageHeader';
import type { DashboardData } from '@/types';

const priorityTone = { urgent: 'danger', important: 'accent', normal: 'neutral' } as const;

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-ink">{compactNumber(value)}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
    </Card>
  );
}

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      </CardHeader>
      <CardBody className="h-56 pt-2">{children}</CardBody>
    </Card>
  );
}

const axisProps = {
  stroke: 'hsl(var(--ink-subtle))',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--surface))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.4375rem',
    fontSize: '0.8125rem',
    color: 'hsl(var(--ink))',
  },
};

export function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/api/dashboard'),
  });

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Good to see you, ${user?.name.split(' ')[0]}`}
        description="Everything that changed on campus since you were last here."
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <CardSkeleton count={2} />
        </div>
      ) : (
        data && (
          <div className="space-y-6">
            <section aria-label="Your figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.stats.map((stat) => (
                <StatTile key={stat.key} label={stat.label} value={stat.value} hint={stat.hint} />
              ))}
            </section>

            {data.charts?.signups && (
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartFrame title="New members, last 14 days">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.signups} margin={{ left: -22, right: 6, top: 6 }}>
                      <defs>
                        <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8)} {...axisProps} />
                      <YAxis allowDecimals={false} width={40} {...axisProps} />
                      <Tooltip {...tooltipStyle} labelFormatter={(v: string) => shortDate(v)} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Members"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#signupFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartFrame>

                {data.charts.departments && (
                  <ChartFrame title="Members by department">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.departments} margin={{ left: -22, right: 6, top: 6 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" {...axisProps} />
                        <YAxis allowDecimals={false} width={40} {...axisProps} />
                        <Tooltip {...tooltipStyle} cursor={{ fill: 'hsl(var(--border) / 0.4)' }} />
                        <Bar dataKey="count" name="Members" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                )}
              </div>
            )}

            {data.charts?.applications && (
              <ChartFrame title="Applications received, last 14 days">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.applications} margin={{ left: -22, right: 6, top: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8)} {...axisProps} />
                    <YAxis allowDecimals={false} width={40} {...axisProps} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(v: string) => shortDate(v)}
                      cursor={{ fill: 'hsl(var(--border) / 0.4)' }}
                    />
                    <Bar dataKey="count" name="Applications" fill="hsl(var(--kind-job))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <h2 className="font-display text-base font-semibold text-ink">Latest notices</h2>
                  <Button variant="link" size="sm" asChild>
                    <Link to="/app/notices">
                      All notices
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </CardHeader>
                <CardBody className="pt-1">
                  {data.latestNotices.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-muted">The board is clear.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.latestNotices.map((notice) => (
                        <li key={notice.id} className="flex items-start gap-3 py-2.5">
                          <Badge
                            tone={priorityTone[notice.priority as keyof typeof priorityTone]}
                            className="mt-0.5 shrink-0 capitalize"
                          >
                            {notice.priority}
                          </Badge>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">{notice.title}</span>
                            <span className="block text-xs text-ink-subtle">
                              {notice.postedBy.name} · {timeAgo(notice.createdAt)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <h2 className="font-display text-base font-semibold text-ink">Coming up</h2>
                  <Button variant="link" size="sm" asChild>
                    <Link to="/app/events">
                      All events
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </CardHeader>
                <CardBody className="pt-1">
                  {data.upcomingEvents.length === 0 ? (
                    <EmptyState
                      title="No events scheduled"
                      message="When staff publish something, it appears here."
                      icon={<CalendarDays className="h-5 w-5" />}
                    />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.upcomingEvents.map((event) => (
                        <li key={event.id} className="py-2.5">
                          <p className="text-sm font-medium text-ink">{event.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-subtle">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" aria-hidden />
                              {eventWhen(event.startsAt)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden />
                              {event.venue}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>

            {data.myJobs && data.myJobs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <h2 className="font-display text-base font-semibold text-ink">Your open roles</h2>
                </CardHeader>
                <CardBody className="pt-1">
                  <ul className="divide-y divide-border">
                    {data.myJobs.map((job) => (
                      <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">{job.title}</span>
                          <span className="block text-xs text-ink-subtle">
                            {job.company} · closes {shortDate(job.applyBy)}
                          </span>
                        </span>
                        <Badge tone="primary" className="shrink-0 tabular-nums">
                          {job.applicationCount} applied
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            {data.myEvents && data.myEvents.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <h2 className="font-display text-base font-semibold text-ink">You are going to</h2>
                </CardHeader>
                <CardBody className="pt-1">
                  <ul className="divide-y divide-border">
                    {data.myEvents.map((event) => (
                      <li key={event.id} className="py-2.5">
                        <p className="text-sm font-medium text-ink">{event.title}</p>
                        <p className="text-xs text-ink-subtle">
                          {eventWhen(event.startsAt)} · {event.venue}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>
        )
      )}
    </>
  );
}
