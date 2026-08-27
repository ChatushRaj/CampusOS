import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Heart, Lock, MessageCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { compactNumber, identityChip, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { Textarea } from '@/components/ui/Field';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import type { Post } from '@/types';

export function PostCard({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.isBookmarked);

  const like = useMutation({
    mutationFn: () => api.post<{ isLiked: boolean; likeCount: number }>(`/api/posts/${post.id}/like`),
    // Optimistic: the button responds immediately, then reconciles with the server.
    onMutate: () => {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? -1 : 1));
    },
    onSuccess: (data) => {
      setLiked(data.isLiked);
      setLikeCount(data.likeCount);
    },
    onError: () => {
      setLiked(post.isLiked);
      setLikeCount(post.likeCount);
      toast.error('Could not register that. Try again.');
    },
  });

  const bookmark = useMutation({
    mutationFn: () => api.post<{ isBookmarked: boolean }>(`/api/posts/${post.id}/bookmark`),
    onMutate: () => setSaved((v) => !v),
    onSuccess: (data) => {
      setSaved(data.isBookmarked);
      toast.success(data.isBookmarked ? 'Saved to your list' : 'Removed from saved');
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onError: () => {
      setSaved(post.isBookmarked);
      toast.error('Could not save that. Try again.');
    },
  });

  const edit = useMutation({
    mutationFn: (body: string) => api.patch(`/api/posts/${post.id}`, { body }),
    onSuccess: () => {
      toast.success('Post updated');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/posts/${post.id}`),
    onSuccess: () => {
      toast.success('Post deleted');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: () => toast.error('Could not delete that post.'),
  });

  const chip = identityChip(post.author);

  return (
    <>
      <Card kind="post" as="article" interactive className="pl-1">
        <CardHeader className="flex items-start gap-3 pb-3">
          <Link to={`/app/people/${post.author.id}`} className="rounded-full">
            <Avatar name={post.author.name} src={post.author.avatarUrl} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <Link to={`/app/people/${post.author.id}`} className="font-medium text-ink hover:underline">
                {post.author.name}
              </Link>
              {post.author.role !== 'student' && (
                <Badge tone="primary" className="capitalize">
                  {post.author.role}
                </Badge>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
              {chip && <span className="font-mono">{chip}</span>}
              <span aria-hidden>·</span>
              <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
              {post.visibility === 'connections' && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" aria-hidden />
                    Connections
                  </span>
                </>
              )}
            </p>
          </div>

          {post.isMine && (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Post options">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem
                  onSelect={() => {
                    setDraft(post.body);
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit post
                </MenuItem>
                <MenuItem destructive onSelect={() => setConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </CardHeader>

        <CardBody className="pb-3">
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink">{post.body}</p>

          {post.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link to={`/app/feed?tag=${encodeURIComponent(tag)}`}>
                    <Badge tone="outline" className="hover:border-primary hover:text-primary">
                      #{tag}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {post.images.length > 0 && (
            <div
              className={cn(
                'mt-3 grid gap-1.5 overflow-hidden rounded-md',
                post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
              )}
            >
              {post.images.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`Attachment ${i + 1} on ${post.author.name}'s post`}
                  loading="lazy"
                  decoding="async"
                  className="h-full max-h-80 w-full rounded-md border border-border object-cover"
                />
              ))}
            </div>
          )}
        </CardBody>

        <CardFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => like.mutate()}
            aria-pressed={liked}
            className={cn(liked && 'text-danger')}
          >
            <Heart className={cn('h-4 w-4', liked && 'fill-current')} aria-hidden />
            <span className="tabular-nums">{compactNumber(likeCount)}</span>
            <span className="sr-only">likes</span>
          </Button>

          <Button variant="ghost" size="sm" asChild>
            <Link to={`/app/posts/${post.id}`}>
              <MessageCircle className="h-4 w-4" aria-hidden />
              <span className="tabular-nums">{compactNumber(post.commentCount)}</span>
              <span className="sr-only">comments</span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn('ml-auto', saved && 'text-primary')}
            onClick={() => bookmark.mutate()}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved' : 'Save post'}
          >
            <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden />
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this post?"
        message="The post and its comments will be removed. This cannot be undone."
        confirmLabel="Delete post"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />

      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit post"
        description="Only the text changes; images and tags stay as they were."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => edit.mutate(draft.trim())}
              loading={edit.isPending}
              disabled={!draft.trim() || draft.trim() === post.body}
            >
              Save changes
            </Button>
          </>
        }
      >
        <Textarea
          rows={6}
          value={draft}
          maxLength={3000}
          aria-label="Post text"
          onChange={(event) => setDraft(event.target.value)}
        />
        <p className="mt-1.5 text-xs text-ink-subtle">{3000 - draft.length} characters left</p>
      </Modal>
    </>
  );
}
