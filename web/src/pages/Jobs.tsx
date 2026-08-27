import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Briefcase, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounced } from '@/hooks/useDebounced';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, GridSkeleton } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { JobCard } from '@/components/cards/JobCard';
import type { Job, Paginated } from '@/types';

const schema = z
  .object({
    title: z.string().trim().min(3, 'Enter the role title').max(120),
    company: z.string().trim().min(2, 'Enter the company name').max(120),
    description: z.string().trim().min(20, 'Describe the role in at least 20 characters').max(8000),
    type: z.enum(['internship', 'full-time', 'part-time', 'freelance']),
    mode: z.enum(['on-site', 'remote', 'hybrid']),
    location: z.string().trim().min(2, 'Enter a location').max(120),
    skills: z.string().optional(),
    openings: z.string().optional(),
    stipendMin: z.string().optional(),
    stipendMax: z.string().optional(),
    applyBy: z.string().min(1, 'Choose an application deadline'),
  })
  .refine((v) => !v.stipendMax || !v.stipendMin || Number(v.stipendMax) >= Number(v.stipendMin), {
    message: 'The maximum must be at least the minimum',
    path: ['stipendMax'],
  });

export function Jobs() {
  useDocumentTitle('Placements');
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [mode, setMode] = useState('');
  const [sort, setSort] = useState('recent');
  const [open, setOpen] = useState(false);
  const q = useDebounced(search);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'internship', mode: 'on-site', openings: '1' },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['jobs', { q, type, mode, sort, page }],
    queryFn: () => api.get<Paginated<Job>>(`/api/jobs${qs({ q, type, mode, sort, page })}`),
  });

  const create = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      api.post('/api/jobs', {
        ...values,
        openings: values.openings ? Number(values.openings) : 1,
        stipendMin: values.stipendMin ? Number(values.stipendMin) : null,
        stipendMax: values.stipendMax ? Number(values.stipendMax) : null,
      }),
    onSuccess: () => {
      toast.success('Opening published');
      form.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Placements"
        description="Internships and roles shared by the placement cell and faculty."
        action={
          can('faculty', 'admin') && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Post an opening
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Role, company or skill"
          aria-label="Search openings"
        />
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role type"
        >
          <option value="">All types</option>
          <option value="internship">Internship</option>
          <option value="full-time">Full time</option>
          <option value="part-time">Part time</option>
          <option value="freelance">Freelance</option>
        </Select>
        <Select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by work mode"
        >
          <option value="">Any location type</option>
          <option value="on-site">On site</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort openings">
          <option value="recent">Newest first</option>
          <option value="deadline">Closing soonest</option>
        </Select>
      </div>

      {isLoading && <GridSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No openings match that"
          message="Try clearing a filter, or check back — the placement cell posts throughout the term."
          icon={<Briefcase className="h-5 w-5" />}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Post an opening"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>
              Publish opening
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role title" error={form.formState.errors.title?.message} required>
              {({ id, invalid }) => <Input id={id} autoFocus invalid={invalid} {...form.register('title')} />}
            </Field>
            <Field label="Company" error={form.formState.errors.company?.message} required>
              {({ id, invalid }) => <Input id={id} invalid={invalid} {...form.register('company')} />}
            </Field>
          </div>

          <Field label="Description" error={form.formState.errors.description?.message} required>
            {({ id, invalid }) => <Textarea id={id} rows={5} invalid={invalid} {...form.register('description')} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              {({ id }) => (
                <Select id={id} {...form.register('type')}>
                  <option value="internship">Internship</option>
                  <option value="full-time">Full time</option>
                  <option value="part-time">Part time</option>
                  <option value="freelance">Freelance</option>
                </Select>
              )}
            </Field>
            <Field label="Work mode">
              {({ id }) => (
                <Select id={id} {...form.register('mode')}>
                  <option value="on-site">On site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </Select>
              )}
            </Field>
            <Field label="Openings">
              {({ id }) => <Input id={id} type="number" min={1} {...form.register('openings')} />}
            </Field>
          </div>

          <Field label="Location" error={form.formState.errors.location?.message} required>
            {({ id, invalid }) => (
              <Input id={id} placeholder="Chennai" invalid={invalid} {...form.register('location')} />
            )}
          </Field>

          <Field label="Skills" hint="Comma separated.">
            {({ id }) => <Input id={id} placeholder="Go, PostgreSQL, REST" {...form.register('skills')} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Stipend from">
              {({ id }) => <Input id={id} type="number" min={0} {...form.register('stipendMin')} />}
            </Field>
            <Field label="Stipend to" error={form.formState.errors.stipendMax?.message}>
              {({ id, invalid }) => (
                <Input id={id} type="number" min={0} invalid={invalid} {...form.register('stipendMax')} />
              )}
            </Field>
            <Field label="Apply by" error={form.formState.errors.applyBy?.message} required>
              {({ id, invalid }) => <Input id={id} type="date" invalid={invalid} {...form.register('applyBy')} />}
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
