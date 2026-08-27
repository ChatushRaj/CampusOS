import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, ImageOff, Mail, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { money, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import type { Listing } from '@/types';

const statusTone = { available: 'success', reserved: 'accent', sold: 'neutral' } as const;

export function ListingCard({ listing }: { listing: Listing }) {
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(listing.isLiked);
  const [likeCount, setLikeCount] = useState(listing.likeCount);
  const [contactOpen, setContactOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const like = useMutation({
    mutationFn: () => api.post<{ isLiked: boolean; likeCount: number }>(`/api/marketplace/${listing.id}/like`),
    onMutate: () => {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? -1 : 1));
    },
    onSuccess: (data) => {
      setLiked(data.isLiked);
      setLikeCount(data.likeCount);
    },
    onError: () => {
      setLiked(listing.isLiked);
      setLikeCount(listing.likeCount);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/marketplace/${listing.id}`),
    onSuccess: () => {
      toast.success('Listing removed');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: () => toast.error('Could not remove that listing.'),
  });

  return (
    <>
      <Card kind="listing" as="article" interactive className="flex flex-col pl-1">
        {listing.images[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            loading="lazy"
            className="h-40 w-full rounded-t-lg border-b border-border object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-t-lg border-b border-border bg-canvas text-ink-subtle">
            <ImageOff className="h-6 w-6" aria-hidden />
            <span className="sr-only">No photo provided</span>
          </div>
        )}

        <CardBody className="flex-1 pt-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-lg font-medium text-ink">{money(listing.price)}</p>
            <Badge tone={statusTone[listing.status]} className="capitalize">
              {listing.status}
            </Badge>
          </div>

          <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-ink">
            <Link to={`/app/marketplace/${listing.id}`} className="hover:underline">
              {listing.title}
            </Link>
          </h3>
          <p className="mt-1 text-xs capitalize text-ink-subtle">
            {listing.condition.replace('-', ' ')} · {listing.category} · {timeAgo(listing.createdAt)}
          </p>

          {listing.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{listing.description}</p>
          )}

          <p className="mt-3 text-sm text-ink-muted">
            Sold by <span className="font-medium text-ink">{listing.seller.name}</span>
          </p>
        </CardBody>

        <CardFooter className="gap-2 px-3 py-2.5">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => setContactOpen(true)}>
            <Mail className="h-4 w-4" aria-hidden />
            Contact seller
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(liked && 'text-danger')}
            onClick={() => like.mutate()}
            aria-pressed={liked}
          >
            <Heart className={cn('h-4 w-4', liked && 'fill-current')} aria-hidden />
            <span className="tabular-nums">{likeCount}</span>
          </Button>
          {listing.canManage && (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Listing options">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem destructive onSelect={() => setConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Remove listing
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </CardFooter>
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
