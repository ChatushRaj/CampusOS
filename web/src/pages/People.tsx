import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useDebounced } from '@/hooks/useDebounced';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, GridSkeleton } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { PersonCard } from '@/components/cards/PersonCard';
import type { Paginated, PersonRow, UserSummary } from '@/types';

interface RequestsPayload {
  incoming: { id: number; user: UserSummary; createdAt: string }[];
  outgoing: { id: number; user: UserSummary; createdAt: string }[];
}

export function People() {
  useDocumentTitle('People');
  const [tab, setTab] = useState('directory');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const q = useDebounced(search);

  const directory = useQuery({
    queryKey: ['people', { q, role, page }],
    queryFn: () => api.get<Paginated<PersonRow>>(`/api/users${qs({ q, role, page })}`),
    enabled: tab === 'directory',
  });

  const suggestions = useQuery({
    queryKey: ['people-suggestions'],
    queryFn: () => api.get<{ items: UserSummary[] }>('/api/users/suggestions'),
    enabled: tab === 'directory',
  });

  const requests = useQuery({
    queryKey: ['connection-requests'],
    queryFn: () => api.get<RequestsPayload>('/api/connections/requests'),
  });

  const connections = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<Paginated<{ connectionId: number; user: UserSummary }>>('/api/connections'),
    enabled: tab === 'connections',
  });

  const pendingCount = requests.data?.incoming.length ?? 0;

  return (
    <>
      <PageHeader title="People" description="Find people across departments and years, and manage your connections." />

      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {pendingCount > 0 && (
              <Badge tone="danger" className="ml-1.5">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="connections">My connections</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'directory' && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, department or interest"
              aria-label="Search people"
            />
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by role"
              className="sm:w-44"
            >
              <option value="">Everyone</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Administrators</option>
            </Select>
          </div>

          {/* Only shown on an unfiltered directory, where a suggestion is useful rather than noise. */}
          {!q && !role && suggestions.data && suggestions.data.items.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">Suggested for you</h2>
              <p className="-mt-2 mb-3 text-sm text-ink-muted">People in your department or graduating year.</p>
              <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.data.items.map((person) => (
                  <PersonCard key={person.id} person={{ ...person, connection: null }} />
                ))}
              </div>
            </section>
          )}

          {directory.isLoading && <GridSkeleton />}
          {directory.isError && <ErrorState onRetry={() => directory.refetch()} />}

          {directory.data && directory.data.items.length === 0 && (
            <EmptyState
              title="Nobody matches that"
              message="Try a different name or clear the filter."
              icon={<Users className="h-5 w-5" />}
            />
          )}

          {directory.data && directory.data.items.length > 0 && (
            <>
              <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {directory.data.items.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
              <Pagination
                page={directory.data.page}
                totalPages={directory.data.totalPages}
                total={directory.data.total}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}

      {tab === 'requests' && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Waiting on you</h2>
            {requests.data?.incoming.length === 0 ? (
              <EmptyState
                title="No pending requests"
                message="When somebody asks to connect, they appear here."
                icon={<UserPlus className="h-5 w-5" />}
              />
            ) : (
              <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {requests.data?.incoming.map((row) => (
                  <PersonCard
                    key={row.id}
                    person={{ ...row.user, connection: { id: row.id, status: 'pending', direction: 'incoming' } }}
                  />
                ))}
              </div>
            )}
          </section>

          {requests.data && requests.data.outgoing.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-ink">Requests you sent</h2>
              <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {requests.data.outgoing.map((row) => (
                  <PersonCard
                    key={row.id}
                    person={{ ...row.user, connection: { id: row.id, status: 'pending', direction: 'outgoing' } }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'connections' && (
        <>
          {connections.isLoading && <GridSkeleton />}
          {connections.data && connections.data.items.length === 0 && (
            <EmptyState
              title="No connections yet"
              message="Browse the directory and send a few requests."
              icon={<Users className="h-5 w-5" />}
            />
          )}
          {connections.data && connections.data.items.length > 0 && (
            <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {connections.data.items.map((row) => (
                <PersonCard
                  key={row.connectionId}
                  person={{
                    ...row.user,
                    connection: { id: row.connectionId, status: 'accepted', direction: 'outgoing' },
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
