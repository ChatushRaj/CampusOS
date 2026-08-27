import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounced } from '@/hooks/useDebounced';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, GridSkeleton } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventCard } from '@/components/cards/EventCard';
import type { CampusEvent, Paginated } from '@/types';

const schema = z
  .object({
    title: z.string().trim().min(4, 'Give the event a title').max(160),
    description: z.string().trim().max(5000).optional(),
    category: z.enum(['workshop', 'cultural', 'sports', 'seminar', 'hackathon', 'other']),
    startsAt: z.string().min(1, 'Choose a start date and time'),
    endsAt: z.string().optional(),
    venue: z.string().trim().min(2, 'Where is it happening?').max(160),
    capacity: z.string().optional(),
  })
  .refine((v) => !v.endsAt || new Date(v.endsAt) >= new Date(v.startsAt), {
    message: 'The end time must be after the start time',
    path: ['endsAt'],
  });

export function Events() {
  useDocumentTitle('Events');
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [when, setWhen] = useState('upcoming');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebounced(search);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'workshop' },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['events', { when, category, q, page }],
    queryFn: () => api.get<Paginated<CampusEvent>>(`/api/events${qs({ when, category, q, page })}`),
  });

  const create = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      api.post('/api/events', {
        ...values,
        endsAt: values.endsAt || null,
        capacity: values.capacity ? Number(values.capacity) : null,
      }),
    onSuccess: () => {
      toast.success('Event published');
      form.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Events"
        description="Workshops, talks and everything else happening across campus."
        action={
          can('faculty', 'admin') && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add an event
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={when}
          onValueChange={(v) => {
            setWhen(v);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search events"
          aria-label="Search events"
          className="w-full sm:w-56"
        />

        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
          className="w-full sm:w-44"
        >
          <option value="">All categories</option>
          <option value="workshop">Workshop</option>
          <option value="seminar">Seminar</option>
          <option value="hackathon">Hackathon</option>
          <option value="cultural">Cultural</option>
          <option value="sports">Sports</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {isLoading && <GridSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={when === 'past' ? 'No past events' : 'Nothing scheduled yet'}
          message={
            when === 'past'
              ? 'Events move here once they finish.'
              : 'When faculty or administrators publish an event, it appears here.'
          }
          icon={<CalendarDays className="h-5 w-5" />}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add an event"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>
              Publish event
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Field label="Title" error={form.formState.errors.title?.message} required>
            {({ id, invalid }) => <Input id={id} autoFocus invalid={invalid} {...form.register('title')} />}
          </Field>

          <Field label="Description" error={form.formState.errors.description?.message}>
            {({ id }) => <Textarea id={id} rows={4} {...form.register('description')} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" error={form.formState.errors.startsAt?.message} required>
              {({ id, invalid }) => (
                <Input id={id} type="datetime-local" invalid={invalid} {...form.register('startsAt')} />
              )}
            </Field>
            <Field label="Ends" error={form.formState.errors.endsAt?.message}>
              {({ id, invalid }) => (
                <Input id={id} type="datetime-local" invalid={invalid} {...form.register('endsAt')} />
              )}
            </Field>
          </div>

          <Field label="Venue" error={form.formState.errors.venue?.message} required>
            {({ id, invalid }) => (
              <Input id={id} placeholder="CS Seminar Hall, Block A" invalid={invalid} {...form.register('venue')} />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              {({ id }) => (
                <Select id={id} {...form.register('category')}>
                  <option value="workshop">Workshop</option>
                  <option value="seminar">Seminar</option>
                  <option value="hackathon">Hackathon</option>
                  <option value="cultural">Cultural</option>
                  <option value="sports">Sports</option>
                  <option value="other">Other</option>
                </Select>
              )}
            </Field>
            <Field label="Capacity" hint="Leave blank for unlimited.">
              {({ id }) => <Input id={id} type="number" min={0} {...form.register('capacity')} />}
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
