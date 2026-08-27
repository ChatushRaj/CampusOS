import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, Eye, Heart, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { shortDate, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CardSkeleton, ErrorState, Skeleton } from '@/components/ui/States';
import type { Blog, Comment, Paginated } from '@/types';

export function BlogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['blog', id],
    queryFn: () => api.get<{ blog: Blog }>(`/api/blogs/${id}`),
    enabled: Boolean(id),
  });

  const blog = data?.blog;
  useDocumentTitle(blog?.title ?? 'Article');

  const comments = useQuery({
    queryKey: ['blog-comments', id],
    queryFn: () => api.get<Paginated<Comment>>(`/api/blogs/${id}/comments`),
    enabled: Boolean(id),
  });

  const like = useMutation({
    mutationFn: () => api.post(`/api/blogs/${id}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blog', id] }),
  });

  const bookmark = useMutation({
    mutationFn: () => api.post<{ isBookmarked: boolean }>(`/api/blogs/${id}/bookmark`),
    onSuccess: (result) => {
      toast.success(result.isBookmarked ? 'Saved to your list' : 'Removed from saved');
      queryClient.invalidateQueries({ queryKey: ['blog', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  const addComment = useMutation({
    mutationFn: () => api.post(`/api/blogs/${id}/comments`, { body: draft }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['blog-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['blog', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: number) => api.delete(`/api/blogs/${id}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['blog', id] });
    },
  });

  const removeArticle = useMutation({
    mutationFn: () => api.delete(`/api/blogs/${id}`),
    onSuccess: () => {
      toast.success('Article deleted');
      navigate('/app/blogs');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !blog) return <ErrorState message="This article may have been removed." onRetry={() => refetch()} />;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/app/blogs">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All articles
        </Link>
      </Button>

      <article>
        <p className="eyebrow">
          {blog.readMinutes} min read · {shortDate(blog.createdAt)}
        </p>
        <h1 className="mt-3 font-display text-display-md font-semibold leading-tight text-ink">{blog.title}</h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-border py-3">
          <Link to={`/app/people/${blog.author.id}`} className="flex items-center gap-2.5 rounded-sm">
            <Avatar name={blog.author.name} src={blog.author.avatarUrl} />
            <span>
              <span className="block text-sm font-medium text-ink hover:underline">{blog.author.name}</span>
              <span className="block text-xs text-ink-subtle">{blog.author.headline || blog.author.department}</span>
            </span>
          </Link>

          <span className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => like.mutate()}
              aria-pressed={blog.isLiked}
              className={cn(blog.isLiked && 'text-danger')}
            >
              <Heart className={cn('h-4 w-4', blog.isLiked && 'fill-current')} aria-hidden />
              <span className="tabular-nums">{blog.likeCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => bookmark.mutate()}
              aria-pressed={blog.isBookmarked}
              className={cn(blog.isBookmarked && 'text-primary')}
              aria-label={blog.isBookmarked ? 'Remove from saved' : 'Save article'}
            >
              <Bookmark className={cn('h-4 w-4', blog.isBookmarked && 'fill-current')} aria-hidden />
            </Button>
            <span className="flex items-center gap-1 px-2 text-xs tabular-nums text-ink-subtle">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              {blog.viewCount}
            </span>
            {blog.isMine && (
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </Button>
            )}
          </span>
        </div>

        {blog.coverUrl && (
          <img src={blog.coverUrl} alt="" className="mt-6 w-full rounded-lg border border-border object-cover" />
        )}

        <div className="mt-6 space-y-4 text-[1.0625rem] leading-[1.75] text-ink">
          {(blog.body ?? '')
            .split('\n')
            .filter((p) => p.trim())
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
        </div>

        {blog.tags.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-1.5">
            {blog.tags.map((tag) => (
              <li key={tag}>
                <Badge tone="outline">#{tag}</Badge>
              </li>
            ))}
          </ul>
        )}
      </article>

      <section className="mt-10" aria-labelledby="discussion">
        <h2 id="discussion" className="font-display text-lg font-semibold text-ink">
          Discussion ({blog.commentCount})
        </h2>

        <Card className="mt-3">
          <CardBody className="pt-4">
            <label htmlFor="comment" className="sr-only">
              Add a comment
            </label>
            <Textarea
              id="comment"
              rows={3}
              value={draft}
              maxLength={1000}
              placeholder="Add to the discussion…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                loading={addComment.isPending}
                disabled={!draft.trim()}
                onClick={() => addComment.mutate()}
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Comment
              </Button>
            </div>
          </CardBody>
        </Card>

        {comments.isLoading && (
          <div className="mt-4">
            <CardSkeleton count={2} />
          </div>
        )}

        {comments.data && comments.data.items.length === 0 && (
          <p className="mt-6 text-center text-sm text-ink-muted">No comments yet. Start the discussion.</p>
        )}

        <ul className="mt-4 space-y-3">
          {comments.data?.items.map((comment) => (
            <li key={comment.id}>
              <Card>
                <CardBody className="flex items-start gap-3 pt-4">
                  <Avatar name={comment.author.name} src={comment.author.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link to={`/app/people/${comment.author.id}`} className="font-medium text-ink hover:underline">
                        {comment.author.name}
                      </Link>
                      <span className="ml-2 text-xs text-ink-subtle">{timeAgo(comment.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{comment.body}</p>
                  </div>
                  {comment.isMine && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete comment"
                      onClick={() => deleteComment.mutate(comment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this article?"
        message="The article and its discussion will be removed permanently."
        confirmLabel="Delete article"
        destructive
        loading={removeArticle.isPending}
        onConfirm={() => removeArticle.mutate()}
      />
    </>
  );
}
