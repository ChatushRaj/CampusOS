import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ShoppingBag } from 'lucide-react';
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
import { ListingCard } from '@/components/cards/ListingCard';
import type { Listing, Paginated } from '@/types';

const schema = z.object({
  title: z.string().trim().min(3, 'Describe what you are selling').max(100),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(['books', 'electronics', 'furniture', 'cycles', 'tickets', 'other']),
  condition: z.enum(['new', 'like-new', 'used']),
  price: z.string().min(1, 'Enter a price'),
  contact: z.string().trim().min(3, 'Add a way for buyers to reach you').max(120),
});

export function Marketplace() {
  useDocumentTitle('Marketplace');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const q = useDebounced(search);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'other', condition: 'used' },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', { q, category, sort, page }],
    queryFn: () => api.get<Paginated<Listing>>(`/api/marketplace${qs({ q, category, sort, page })}`),
  });

  const create = useMutation({
    mutationFn: (values: z.infer<typeof schema>) => {
      const data = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (value) data.set(key, String(value));
      }
      for (const file of files) data.append('images', file);
      return api.upload('/api/marketplace', data);
    },
    onSuccess: () => {
      toast.success('Listing published');
      form.reset();
      setFiles([]);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Buy and sell within campus — textbooks, cycles, calculators and whatever else needs a new owner."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            List an item
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search listings"
          aria-label="Search listings"
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
          <option value="books">Books</option>
          <option value="electronics">Electronics</option>
          <option value="furniture">Furniture</option>
          <option value="cycles">Cycles</option>
          <option value="tickets">Tickets</option>
          <option value="other">Other</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort listings">
          <option value="recent">Newest first</option>
          <option value="price-asc">Price, low to high</option>
          <option value="price-desc">Price, high to low</option>
        </Select>
      </div>

      {isLoading && <GridSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="Nothing listed yet"
          message="Be the first to list something. Textbooks and cycles move fastest."
          icon={<ShoppingBag className="h-5 w-5" />}
          action={<Button onClick={() => setOpen(true)}>List an item</Button>}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="List an item"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>
              Publish listing
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Field label="What are you selling?" error={form.formState.errors.title?.message} required>
            {({ id, invalid }) => <Input id={id} autoFocus invalid={invalid} {...form.register('title')} />}
          </Field>

          <Field label="Description" error={form.formState.errors.description?.message}>
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                placeholder="Condition, how long you used it, anything a buyer should know."
                {...form.register('description')}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category">
              {({ id }) => (
                <Select id={id} {...form.register('category')}>
                  <option value="books">Books</option>
                  <option value="electronics">Electronics</option>
                  <option value="furniture">Furniture</option>
                  <option value="cycles">Cycles</option>
                  <option value="tickets">Tickets</option>
                  <option value="other">Other</option>
                </Select>
              )}
            </Field>
            <Field label="Condition">
              {({ id }) => (
                <Select id={id} {...form.register('condition')}>
                  <option value="new">New</option>
                  <option value="like-new">Like new</option>
                  <option value="used">Used</option>
                </Select>
              )}
            </Field>
            <Field label="Price (₹)" error={form.formState.errors.price?.message} required>
              {({ id, invalid }) => (
                <Input id={id} type="number" min={0} invalid={invalid} {...form.register('price')} />
              )}
            </Field>
          </div>

          <Field label="How should buyers reach you?" error={form.formState.errors.contact?.message} required>
            {({ id, invalid }) => (
              <Input id={id} placeholder="Email or phone number" invalid={invalid} {...form.register('contact')} />
            )}
          </Field>

          <div>
            <label
              htmlFor="listing-images"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-ink-muted hover:border-ink-subtle/50 hover:text-ink"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add photos
            </label>
            <input
              id="listing-images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
            />
            {files.length > 0 && (
              <p className="mt-2 text-xs text-ink-subtle">
                {files.length} {files.length === 1 ? 'photo' : 'photos'} selected
              </p>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}
