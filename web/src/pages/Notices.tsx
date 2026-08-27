import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Megaphone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounced } from '@/hooks/useDebounced';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { NoticeCard } from '@/components/cards/NoticeCard';
import type { Notice, Paginated } from '@/types';

const schema = z.object({
  title: z.string().trim().min(4, 'Give the notice a title').max(160),
  body: z.string().trim().min(1, 'Add the notice details').max(5000),
  category: z.enum(['academic', 'examination', 'placement', 'facility', 'general']),
  priority: z.enum(['normal', 'important', 'urgent']),
  expiresAt: z.string().optional(),
  pinned: z.boolean().optional(),
});

export function Notices() {
  useDocumentTitle('Notices');
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebounced(search);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'general', priority: 'normal', pinned: false },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notices', { q, category, priority, page }],
    queryFn: () => api.get<Paginated<Notice>>(`/api/notices${qs({ q, category, priority, page })}`),
  });

  const create = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      api.post('/api/notices', { ...values, expiresAt: values.expiresAt || null }),
    onSuccess: () => {
      toast.success('Notice published');
      form.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Notice board"
        description="Official announcements from faculty and administration. Expired notices come off the board automatically."
        action={
          can('faculty', 'admin') && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Post a notice
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search notices"
          aria-label="Search notices"
        />
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          <option value="academic">Academic</option>
          <option value="examination">Examination</option>
          <option value="placement">Placement</option>
          <option value="facility">Facility</option>
          <option value="general">General</option>
        </Select>
        <Select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by priority"
        >
          <option value="">Any priority</option>
          <option value="urgent">Urgent</option>
          <option value="important">Important</option>
          <option value="normal">Normal</option>
        </Select>
      </div>

      {isLoading && <CardSkeleton count={4} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={q || category || priority ? 'No notices match those filters' : 'The board is clear'}
          message={
            q || category || priority
              ? 'Try a different keyword, or clear the filters.'
              : 'Nothing has been posted yet. New announcements land here first.'
          }
          icon={<Megaphone className="h-5 w-5" />}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="stagger space-y-3">
            {data.items.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Post a notice"
        description="Urgent notices also send a notification to everyone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>
              Publish notice
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Field label="Title" error={form.formState.errors.title?.message} required>
            {({ id, invalid }) => <Input id={id} autoFocus invalid={invalid} {...form.register('title')} />}
          </Field>

          <Field label="Details" error={form.formState.errors.body?.message} required>
            {({ id, invalid }) => <Textarea id={id} rows={5} invalid={invalid} {...form.register('body')} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              {({ id }) => (
                <Select id={id} {...form.register('category')}>
                  <option value="general">General</option>
                  <option value="academic">Academic</option>
                  <option value="examination">Examination</option>
                  <option value="placement">Placement</option>
                  <option value="facility">Facility</option>
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {({ id }) => (
                <Select id={id} {...form.register('priority')}>
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </Select>
              )}
            </Field>
          </div>

          <Field label="Valid until" hint="Leave blank to keep it on the board indefinitely.">
            {({ id }) => <Input id={id} type="date" {...form.register('expiresAt')} />}
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              {...form.register('pinned')}
            />
            Pin to the top of the board
          </label>
        </form>
      </Modal>
    </>
  );
}
