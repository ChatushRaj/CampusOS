import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart2, ImagePlus, MessageSquareText, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { PostCard } from '@/components/cards/PostCard';
import { PollCard } from '@/components/cards/PollCard';
import type { Paginated, Poll, Post } from '@/types';

const MAX_BODY = 3000;
const MAX_IMAGES = 4;

const postSchema = z.object({
  body: z.string().trim().min(1, 'Write something to share').max(MAX_BODY, `Keep it under ${MAX_BODY} characters`),
  visibility: z.enum(['campus', 'connections']),
  tags: z.string().optional(),
});

const pollSchema = z.object({
  question: z.string().trim().min(4, 'Ask a question').max(200),
  optionA: z.string().trim().min(1, 'Enter an option').max(80),
  optionB: z.string().trim().min(1, 'Enter an option').max(80),
  optionC: z.string().trim().max(80).optional(),
  optionD: z.string().trim().max(80).optional(),
});

function Composer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: { body: '', visibility: 'campus', tags: '' },
  });
  const pollForm = useForm<z.infer<typeof pollSchema>>({ resolver: zodResolver(pollSchema) });

  const body = form.watch('body') ?? '';

  const createPost = useMutation({
    mutationFn: (values: z.infer<typeof postSchema>) => {
      // Multipart, because the same request carries up to four images.
      const data = new FormData();
      data.set('body', values.body);
      data.set('visibility', values.visibility);
      if (values.tags) data.set('tags', values.tags);
      for (const file of files) data.append('images', file);
      return api.upload('/api/posts', data);
    },
    onSuccess: () => {
      toast.success('Posted');
      form.reset();
      setFiles([]);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createPoll = useMutation({
    mutationFn: (values: z.infer<typeof pollSchema>) =>
      api.post('/api/polls', {
        question: values.question,
        options: [values.optionA, values.optionB, values.optionC, values.optionD].filter((o): o is string =>
          Boolean(o && o.trim()),
        ),
      }),
    onSuccess: () => {
      toast.success('Poll published');
      pollForm.reset();
      setPollOpen(false);
      queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)].slice(0, MAX_IMAGES);
    const oversize = next.find((f) => f.size > 5 * 1024 * 1024);
    if (oversize) {
      toast.error('Images must be smaller than 5 MB.');
      return;
    }
    setFiles(next);
  };

  return (
    <>
      <Card className="mb-5">
        <CardBody className="flex items-center gap-3 pt-4">
          <Avatar name={user?.name ?? ''} src={user?.avatarUrl} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-1 rounded-md border border-input bg-canvas px-3 py-2.5 text-left text-sm text-ink-subtle transition-colors hover:border-ink-subtle/50 hover:text-ink-muted"
          >
            Share something with campus…
          </button>
          <Button variant="ghost" size="icon" onClick={() => setPollOpen(true)} aria-label="Create a poll">
            <BarChart2 className="h-[1.125rem] w-[1.125rem]" />
          </Button>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Create a post"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={createPost.isPending} onClick={form.handleSubmit((v) => createPost.mutate(v))}>
              <Send className="h-4 w-4" aria-hidden />
              Publish
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => createPost.mutate(v))}>
          <Field label="What's happening?" error={form.formState.errors.body?.message} required>
            {({ id, describedBy, invalid }) => (
              <>
                <Textarea
                  id={id}
                  rows={5}
                  autoFocus
                  aria-describedby={describedBy}
                  invalid={invalid}
                  {...form.register('body')}
                />
                <p className="mt-1 text-right text-xs tabular-nums text-ink-subtle">
                  {body.length} / {MAX_BODY}
                </p>
              </>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visible to">
              {({ id }) => (
                <Select id={id} {...form.register('visibility')}>
                  <option value="campus">Everyone on campus</option>
                  <option value="connections">My connections only</option>
                </Select>
              )}
            </Field>
            <Field label="Tags" hint="Comma separated, up to six.">
              {({ id }) => <Input id={id} placeholder="robotics, clubs" {...form.register('tags')} />}
            </Field>
          </div>

          <div>
            <label
              htmlFor="post-images"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-ink-muted transition-colors hover:border-ink-subtle/50 hover:text-ink"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Add images
            </label>
            <input
              id="post-images"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
            <p className="mt-1 text-xs text-ink-subtle">Up to {MAX_IMAGES} images, 5 MB each.</p>

            {files.length > 0 && (
              <ul className="mt-3 grid grid-cols-4 gap-2">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="h-16 w-full rounded-md border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFiles((f) => f.filter((_, index) => index !== i))}
                      aria-label={`Remove image ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-1 text-canvas"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={pollOpen}
        onOpenChange={setPollOpen}
        title="Create a poll"
        description="Two options minimum, four maximum."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPollOpen(false)}>
              Cancel
            </Button>
            <Button loading={createPoll.isPending} onClick={pollForm.handleSubmit((v) => createPoll.mutate(v))}>
              Publish poll
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={pollForm.handleSubmit((v) => createPoll.mutate(v))}>
          <Field label="Question" error={pollForm.formState.errors.question?.message} required>
            {({ id, invalid }) => <Input id={id} autoFocus invalid={invalid} {...pollForm.register('question')} />}
          </Field>
          <Field label="Option 1" error={pollForm.formState.errors.optionA?.message} required>
            {({ id, invalid }) => <Input id={id} invalid={invalid} {...pollForm.register('optionA')} />}
          </Field>
          <Field label="Option 2" error={pollForm.formState.errors.optionB?.message} required>
            {({ id, invalid }) => <Input id={id} invalid={invalid} {...pollForm.register('optionB')} />}
          </Field>
          <Field label="Option 3">{({ id }) => <Input id={id} {...pollForm.register('optionC')} />}</Field>
          <Field label="Option 4">{({ id }) => <Input id={id} {...pollForm.register('optionD')} />}</Field>
        </form>
      </Modal>
    </>
  );
}

export function Feed() {
  useDocumentTitle('Feed');
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const scope = params.get('scope') ?? 'campus';
  const tag = params.get('tag') ?? undefined;

  const posts = useQuery({
    queryKey: ['posts', { scope, tag, page }],
    queryFn: () => api.get<Paginated<Post>>(`/api/posts${qs({ scope, tag, page })}`),
  });

  const polls = useQuery({
    queryKey: ['polls'],
    queryFn: () => api.get<Paginated<Poll>>('/api/polls?limit=2'),
  });

  return (
    <>
      <PageHeader title="Campus feed" description="What people across departments are sharing right now." />

      <Composer />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={scope}
          onValueChange={(value) => {
            setPage(1);
            setParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('scope', value);
              return next;
            });
          }}
        >
          <TabsList>
            <TabsTrigger value="campus">All campus</TabsTrigger>
            <TabsTrigger value="connections">My connections</TabsTrigger>
          </TabsList>
        </Tabs>

        {tag && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('tag');
                return next;
              })
            }
          >
            #{tag}
            <X className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Clear tag filter</span>
          </Button>
        )}
      </div>

      {polls.data?.items.length ? (
        <div className="mb-5 space-y-3">
          {polls.data.items.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </div>
      ) : null}

      {posts.isLoading && <CardSkeleton count={3} />}
      {posts.isError && <ErrorState onRetry={() => posts.refetch()} />}

      {posts.data && posts.data.items.length === 0 && (
        <EmptyState
          title={
            tag
              ? `Nothing tagged #${tag}`
              : scope === 'connections'
                ? 'Your connections have not posted yet'
                : 'The feed is empty'
          }
          message={
            scope === 'connections'
              ? 'Connect with more people, or switch to the campus-wide view.'
              : 'Be the first to share something with your campus.'
          }
          icon={<MessageSquareText className="h-5 w-5" />}
        />
      )}

      {posts.data && posts.data.items.length > 0 && (
        <>
          <div className="stagger space-y-3">
            {posts.data.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          <Pagination
            page={posts.data.page}
            totalPages={posts.data.totalPages}
            total={posts.data.total}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
