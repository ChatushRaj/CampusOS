import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageCircle, Plus, Send, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useDebounced } from '@/hooks/useDebounced';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import type { Paginated, UserSummary } from '@/types';

const CATEGORIES = ['academic', 'coding', 'projects', 'creative', 'fitness', 'languages', 'other'] as const;

interface Group {
  id: number;
  name: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  memberCount: number;
  owner: UserSummary;
  isMember: boolean;
  canManage: boolean;
  createdAt: string;
}

interface Reply {
  id: number;
  body: string;
  author: UserSummary;
  isMine: boolean;
  createdAt: string;
}

interface Discussion {
  id: number;
  body: string;
  replyCount: number;
  author: UserSummary;
  isMine: boolean;
  createdAt: string;
  replies: Reply[];
}

const schema = z.object({
  name: z.string().trim().min(3, 'Give the group a name').max(80),
  description: z.string().trim().max(600).optional(),
  category: z.enum(CATEGORIES),
});

type FormValues = z.infer<typeof schema>;

export function Groups() {
  useDocumentTitle('Groups');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const debounced = useDebounced(search, 300);

  const groups = useQuery({
    queryKey: ['groups', debounced, category, mine, page],
    queryFn: () =>
      api.get<Paginated<Group>>(`/api/groups${qs({ q: debounced, category, mine: mine || undefined, page })}`),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', category: 'other' },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) => api.post<{ group: Group }>('/api/groups', values),
    onSuccess: () => {
      toast.success('Group created');
      setCreateOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const membership = useMutation({
    mutationFn: (id: number) => api.post<{ isMember: boolean }>(`/api/groups/${id}/membership`, {}),
    onSuccess: (data) => {
      toast.success(data.isMember ? 'Joined the group' : 'Left the group');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/groups/${id}`),
    onSuccess: () => {
      toast.success('Group deleted');
      setOpenGroup(null);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Study groups"
        title="Groups"
        description="Small rooms for a subject, a project or a habit. Join one to see its discussion."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Start a group
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search groups"
          aria-label="Search groups"
          className="max-w-xs"
        />
        <Select
          value={category}
          aria-label="Filter by category"
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value} className="capitalize">
              {value}
            </option>
          ))}
        </Select>
        <Button
          variant={mine ? 'primary' : 'secondary'}
          aria-pressed={mine}
          onClick={() => {
            setMine((v) => !v);
            setPage(1);
          }}
        >
          My groups
        </Button>
      </div>

      {groups.isPending && <CardSkeleton count={6} />}
      {groups.isError && <ErrorState onRetry={() => groups.refetch()} />}

      {groups.data && groups.data.items.length === 0 && (
        <EmptyState
          icon={<UsersRound className="h-5 w-5" />}
          title="No groups here yet"
          message={mine ? 'You have not joined a group yet.' : 'Be the first to start one.'}
          action={<Button onClick={() => setCreateOpen(true)}>Start a group</Button>}
        />
      )}

      {groups.data && groups.data.items.length > 0 && (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.data.items.map((group) => (
            <Card key={group.id} kind="poll" as="article" interactive className="flex flex-col pl-1">
              <CardBody className="flex flex-1 flex-col pt-4">
                <div className="flex items-center gap-2">
                  <Badge tone="outline" className="capitalize">
                    {group.category}
                  </Badge>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-subtle">
                    <UsersRound className="h-3.5 w-3.5" aria-hidden />
                    {group.memberCount}
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink">{group.name}</h3>
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-muted">{group.description}</p>
                <p className="mt-2 text-xs text-ink-subtle">Started by {group.owner.name}</p>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant={group.isMember ? 'secondary' : 'primary'}
                    className="flex-1"
                    loading={membership.isPending && membership.variables === group.id}
                    onClick={() => membership.mutate(group.id)}
                  >
                    {group.isMember ? 'Leave' : 'Join'}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!group.isMember} onClick={() => setOpenGroup(group)}>
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Discussion
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {groups.data && groups.data.totalPages > 1 && (
        <Pagination
          page={groups.data.page}
          totalPages={groups.data.totalPages}
          total={groups.data.total}
          onChange={setPage}
        />
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Start a group"
        description="Anyone on campus can find and join it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={form.handleSubmit((values) => create.mutate(values))} loading={create.isPending}>
              Create group
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" error={form.formState.errors.name?.message} required>
            {({ id, invalid }) => (
              <Input id={id} autoFocus invalid={invalid} placeholder="Database internals" {...form.register('name')} />
            )}
          </Field>

          <Field label="Category">
            {({ id }) => (
              <Select id={id} {...form.register('category')}>
                {CATEGORIES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="What is it for?" error={form.formState.errors.description?.message}>
            {({ id, invalid }) => (
              <Textarea
                id={id}
                rows={3}
                invalid={invalid}
                placeholder="What you meet about, and how often."
                {...form.register('description')}
              />
            )}
          </Field>
        </div>
      </Modal>

      {openGroup && (
        <GroupDiscussion
          group={openGroup}
          onClose={() => setOpenGroup(null)}
          onDelete={() => remove.mutate(openGroup.id)}
          deleting={remove.isPending}
        />
      )}
    </>
  );
}

/** The discussion inside one group. Only members can open it; the API enforces that too. */
function GroupDiscussion({
  group,
  onClose,
  onDelete,
  deleting,
}: {
  group: Group;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const discussions = useQuery({
    queryKey: ['group-discussions', group.id],
    queryFn: () => api.get<Paginated<Discussion>>(`/api/groups/${group.id}/discussions`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['group-discussions', group.id] });

  const post = useMutation({
    mutationFn: (body: string) => api.post(`/api/groups/${group.id}/discussions`, { body }),
    onSuccess: () => {
      setMessage('');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reply = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.post(`/api/groups/${group.id}/discussions/${id}/replies`, { body }),
    onSuccess: () => {
      setReplyText('');
      setReplyTo(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMessage = useMutation({
    mutationFn: (id: number) => api.delete(`/api/groups/${group.id}/discussions/${id}`),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Modal
      open
      onOpenChange={onClose}
      size="lg"
      title={group.name}
      description={`${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`}
      footer={
        <>
          {group.canManage && (
            <Button variant="danger" onClick={onDelete} loading={deleting}>
              Delete group
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={message}
            maxLength={2000}
            aria-label={`Post to ${group.name}`}
            placeholder="Start a discussion"
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button
            aria-label="Post message"
            disabled={!message.trim()}
            loading={post.isPending}
            onClick={() => post.mutate(message.trim())}
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        {discussions.isPending && <CardSkeleton count={2} />}
        {discussions.isError && <ErrorState onRetry={() => discussions.refetch()} />}

        {discussions.data && discussions.data.items.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-subtle">Nothing here yet. Say the first thing.</p>
        )}

        <ul className="stagger space-y-3">
          {discussions.data?.items.map((discussion) => (
            <li key={discussion.id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-2.5">
                <Avatar src={discussion.author.avatarUrl} name={discussion.author.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {discussion.author.name}{' '}
                    <span className="font-normal text-ink-subtle">
                      · <time dateTime={discussion.createdAt}>{timeAgo(discussion.createdAt)}</time>
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{discussion.body}</p>

                  <div className="mt-2 flex items-center gap-3">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setReplyTo(replyTo === discussion.id ? null : discussion.id)}
                    >
                      Reply{discussion.replyCount > 0 && ` (${discussion.replyCount})`}
                    </Button>
                    {discussion.isMine && (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger"
                        onClick={() => removeMessage.mutate(discussion.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Remove
                      </Button>
                    )}
                  </div>

                  {discussion.replies.length > 0 && (
                    <ul className="mt-2.5 space-y-2 border-l border-border pl-3">
                      {discussion.replies.map((item) => (
                        <li key={item.id} className="text-sm">
                          <span className="font-medium text-ink">{item.author.name}</span>{' '}
                          <span className="text-ink-subtle">· {timeAgo(item.createdAt)}</span>
                          <p className="whitespace-pre-wrap text-ink-muted">{item.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {replyTo === discussion.id && (
                    <div className="mt-2.5 flex gap-2">
                      <Input
                        value={replyText}
                        maxLength={1000}
                        autoFocus
                        aria-label="Your reply"
                        placeholder="Write a reply"
                        onChange={(event) => setReplyText(event.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={!replyText.trim()}
                        loading={reply.isPending}
                        onClick={() => reply.mutate({ id: discussion.id, body: replyText.trim() })}
                      >
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
