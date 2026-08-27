import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { timeAgo } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import type { BookmarkRow, Paginated } from '@/types';

const kindFor = { post: 'post', blog: 'blog', job: 'job', listing: 'listing' } as const;

export function Bookmarks() {
  useDocumentTitle('Saved');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bookmarks', { type, page }],
    queryFn: () => api.get<Paginated<BookmarkRow>>(`/api/bookmarks${qs({ type, page })}`),
  });

  return (
    <>
      <PageHeader
        title="Saved"
        description="Everything you bookmarked, across posts, articles, openings and listings."
      />

      <Tabs
        value={type || 'all'}
        onValueChange={(v) => {
          setType(v === 'all' ? '' : v);
          setPage(1);
        }}
        className="mb-5"
      >
        <TabsList>
          <TabsTrigger value="all">Everything</TabsTrigger>
          <TabsTrigger value="post">Posts</TabsTrigger>
          <TabsTrigger value="blog">Articles</TabsTrigger>
          <TabsTrigger value="job">Openings</TabsTrigger>
          <TabsTrigger value="listing">Listings</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <CardSkeleton count={3} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          message="Tap the bookmark icon on any post, article, opening or listing to keep it here."
          icon={<Bookmark className="h-5 w-5" />}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="stagger space-y-3">
            {data.items.map((row) => (
              <li key={`${row.type}-${row.id}`}>
                <Card kind={kindFor[row.type]} interactive className="pl-1">
                  <CardBody className="flex items-center gap-4 pt-4">
                    {row.images[0] && (
                      <img
                        src={row.images[0]}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Badge tone="outline" className="capitalize">
                        {row.type}
                      </Badge>
                      <h2 className="mt-1.5 truncate font-display text-[0.9375rem] font-semibold text-ink">
                        <Link to={row.href} className="hover:underline">
                          {row.title}
                        </Link>
                      </h2>
                      <p className="truncate text-xs text-ink-subtle">
                        {row.subtitle}
                        {row.author && ` · ${row.author.name}`} · saved {timeAgo(row.savedAt)}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
