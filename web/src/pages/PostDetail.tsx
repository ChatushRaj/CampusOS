import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { PostCard } from '@/components/cards/PostCard';
import type { Comment, Paginated, Post } from '@/types';

export function PostDetail() {
  useDocumentTitle('Post');
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get<{ post: Post }>(`/api/posts/${id}`),
    enabled: Boolean(id),
  });

  const comments = useQuery({
    queryKey: ['post-comments', id],
    queryFn: () => api.get<Paginated<Comment>>(`/api/posts/${id}/comments`),
    enabled: Boolean(id),
  });

  const addComment = useMutation({
    mutationFn: () => api.post(`/api/posts/${id}/comments`, { body: draft }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['post-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: number) => api.delete(`/api/posts/${id}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    },
  });

  if (isLoading) return <CardSkeleton count={1} />;
  if (isError || !data) return <ErrorState message="This post may have been removed." onRetry={() => refetch()} />;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/app/feed">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to feed
        </Link>
      </Button>

      <PostCard post={data.post} />

      <section className="mt-6" aria-labelledby="comments">
        <h2 id="comments" className="font-display text-lg font-semibold text-ink">
          Comments ({data.post.commentCount})
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
              placeholder="Write a reply…"
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
                Reply
              </Button>
            </div>
          </CardBody>
        </Card>

        {comments.data && comments.data.items.length === 0 && (
          <p className="mt-6 text-center text-sm text-ink-muted">No replies yet.</p>
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
    </>
  );
}
