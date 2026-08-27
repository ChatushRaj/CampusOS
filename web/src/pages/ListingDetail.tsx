import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, Heart, ImageOff, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { money, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { ErrorState, Skeleton } from '@/components/ui/States';
import type { Listing } from '@/types';

const statusTone = { available: 'success', reserved: 'accent', sold: 'neutral' } as const;

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => api.get<{ listing: Listing }>(`/api/marketplace/${id}`),
    enabled: Boolean(id),
  });

  const listing = data?.listing;
  useDocumentTitle(listing?.title ?? 'Listing');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['listing', id] });
    queryClient.invalidateQueries({ queryKey: ['listings'] });
  };

  const like = useMutation({
    mutationFn: () => api.post(`/api/marketplace/${id}/like`),
    onSuccess: invalidate,
  });

  const bookmark = useMutation({
    mutationFn: () => api.post<{ isBookmarked: boolean }>(`/api/marketplace/${id}/bookmark`),
    onSuccess: (result) => {
      toast.success(result.isBookmarked ? 'Saved to your list' : 'Removed from saved');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/marketplace/${id}`, { status }),
    onSuccess: () => {
      toast.success('Listing updated');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/marketplace/${id}`),
    onSuccess: () => {
      toast.success('Listing removed');
      navigate('/app/marketplace');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !listing)
    return <ErrorState message="That listing is no longer available." onRetry={() => refetch()} />;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/app/marketplace">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All listings
        </Link>
      </Button>

      <Card kind="listing" className="pl-1">
        <CardBody className="grid gap-6 pt-5 md:grid-cols-2">
          <div>
            {listing.images.length > 0 ? (
              <>
                <img
                  src={listing.images[activeImage]}
                  alt={listing.title}
                  className="aspect-[4/3] w-full rounded-md border border-border object-cover"
                />
                {listing.images.length > 1 && (
                  <ul className="mt-2 flex gap-2">
                    {listing.images.map((src, i) => (
                      <li key={src}>
                        <button
                          type="button"
                          onClick={() => setActiveImage(i)}
                          aria-label={`Show photo ${i + 1}`}
                          aria-current={i === activeImage}
                          className={cn(
                            'overflow-hidden rounded-md border-2 transition-colors',
                            i === activeImage ? 'border-primary' : 'border-transparent hover:border-border',
                          )}
                        >
                          <img src={src} alt="" className="h-14 w-14 object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-border bg-canvas text-ink-subtle">
                <ImageOff className="h-7 w-7" aria-hidden />
                <span className="sr-only">No photo provided</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-2xl font-medium text-ink">{money(listing.price)}</p>
              <Badge tone={statusTone[listing.status]} size="md" className="capitalize">
                {listing.status}
              </Badge>
            </div>

            <h1 className="mt-2 font-display text-display-sm font-semibold leading-tight text-ink">{listing.title}</h1>
            <p className="mt-1.5 text-sm capitalize text-ink-subtle">
              {listing.condition.replace('-', ' ')} · {listing.category} · listed {timeAgo(listing.createdAt)}
            </p>

            {listing.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{listing.description}</p>
            )}

            <div className="mt-5 flex items-center gap-2.5 border-t border-border pt-4">
              <Avatar name={listing.seller.name} src={listing.seller.avatarUrl} size="sm" />
              <div className="min-w-0">
                <Link
                  to={`/app/people/${listing.seller.id}`}
                  className="block text-sm font-medium text-ink hover:underline"
                >
                  {listing.seller.name}
                </Link>
                <p className="text-xs text-ink-subtle">{listing.seller.department ?? 'Seller'}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setContactOpen(true)}>
                <Mail className="h-4 w-4" aria-hidden />
                Contact seller
              </Button>
              <Button
                variant="ghost"
                className={cn(listing.isLiked && 'text-danger')}
                onClick={() => like.mutate()}
                aria-pressed={listing.isLiked}
              >
                <Heart className={cn('h-4 w-4', listing.isLiked && 'fill-current')} aria-hidden />
                <span className="tabular-nums">{listing.likeCount}</span>
              </Button>
              <Button
                variant="ghost"
                className={cn(listing.isBookmarked && 'text-primary')}
                onClick={() => bookmark.mutate()}
                aria-pressed={listing.isBookmarked}
                aria-label={listing.isBookmarked ? 'Remove from saved' : 'Save listing'}
              >
                <Bookmark className={cn('h-4 w-4', listing.isBookmarked && 'fill-current')} aria-hidden />
              </Button>
            </div>

            {listing.canManage && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="eyebrow mb-2">Manage this listing</p>
                <div className="flex flex-wrap gap-2">
                  {(['available', 'reserved', 'sold'] as const)
                    .filter((s) => s !== listing.status)
                    .map((status) => (
                      <Button key={status} variant="secondary" size="sm" onClick={() => setStatus.mutate(status)}>
                        Mark {status}
                      </Button>
                    ))}
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Modal open={contactOpen} onOpenChange={setContactOpen} title={listing.title} size="sm">
        <p className="text-sm text-ink-muted">Reach {listing.seller.name} directly:</p>
        <p className="mt-2 select-all break-all font-mono text-sm font-medium text-ink">{listing.contact}</p>
        <p className="mt-4 text-xs text-ink-subtle">
          Meet in a public place on campus and check the item before paying.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this listing?"
        message="It will no longer appear in the marketplace."
        confirmLabel="Remove listing"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
