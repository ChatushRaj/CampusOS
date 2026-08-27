import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Newspaper, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api';
import { useDebounced } from '@/hooks/useDebounced';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, GridSkeleton } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { BlogCard } from '@/components/cards/BlogCard';
import type { Blog, Paginated } from '@/types';

const schema = z.object({
  title: z.string().trim().min(4, 'Give your article a title').max(140),
  body: z.string().trim().min(40, 'Articles need at least 40 characters').max(20000),
  tags: z.string().optional(),
});

export function Blogs() {
  useDocumentTitle('Articles');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [open, setOpen] = useState(false);
  const q = useDebounced(search);

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const body = form.watch('body') ?? '';
  const readMinutes = Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['blogs', { q, sort, page }],
    queryFn: () => api.get<Paginated<Blog>>(`/api/blogs${qs({ q, sort, page })}`),
  });

  const create = useMutation({
    mutationFn: (values: z.infer<typeof schema>) => api.post('/api/blogs', values),
    onSuccess: () => {
      toast.success('Article published');
      form.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Articles"
        description="Longer pieces written by students and staff — projects, guides and what went wrong."
        action={
          <Button onClick={() => setOpen(true)}>
            <PenLine className="h-4 w-4" aria-hidden />
            Write an article
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search articles"
          aria-label="Search articles"
        />
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort articles" className="sm:w-44">
          <option value="recent">Newest first</option>
          <option value="popular">Most liked</option>
        </Select>
      </div>

      {isLoading && <GridSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={q ? 'No articles match that' : 'Nothing published yet'}
          message={q ? 'Try a different keyword.' : 'Write the first one. A project writeup is a good place to start.'}
          icon={<Newspaper className="h-5 w-5" />}
          action={!q && <Button onClick={() => setOpen(true)}>Write an article</Button>}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((blog) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Write an article"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>
              Publish article
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Field label="Title" error={form.formState.errors.title?.message} required>
            {({ id, invalid }) => <Input id={id} autoFocus invalid={invalid} {...form.register('title')} />}
          </Field>

          <Field label="Article" error={form.formState.errors.body?.message} required>
            {({ id, invalid }) => (
              <>
                <Textarea
                  id={id}
                  rows={14}
                  className="font-sans leading-relaxed"
                  invalid={invalid}
                  {...form.register('body')}
                />
                <p className="mt-1 text-right text-xs tabular-nums text-ink-subtle">
                  {body.trim() ? `about ${readMinutes} min read` : 'Blank lines separate paragraphs'}
                </p>
              </>
            )}
          </Field>

          <Field label="Tags" hint="Comma separated, up to six.">
            {({ id }) => <Input id={id} placeholder="databases, infrastructure" {...form.register('tags')} />}
          </Field>
        </form>
      </Modal>
    </>
  );
}
