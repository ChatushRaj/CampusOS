import { Link } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { shortDate } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import type { Blog } from '@/types';

export function BlogCard({ blog }: { blog: Blog }) {
  return (
    <Card kind="blog" as="article" interactive className="flex flex-col pl-1">
      {blog.coverUrl && (
        <img
          src={blog.coverUrl}
          alt=""
          loading="lazy"
          className="h-36 w-full rounded-t-lg border-b border-border object-cover"
        />
      )}
      <CardBody className="flex flex-1 flex-col pt-4">
        <p className="eyebrow">{blog.readMinutes} min read</p>

        <h3 className="mt-2 font-display text-base font-semibold leading-snug text-ink">
          {/* The whole card is reachable, but only the title is a link target. */}
          <Link to={`/app/blogs/${blog.id}`} className="after:absolute after:inset-0 hover:underline">
            {blog.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{blog.excerpt}</p>

        {blog.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {blog.tags.slice(0, 3).map((tag) => (
              <li key={tag}>
                <Badge tone="outline">#{tag}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          <Avatar name={blog.author.name} src={blog.author.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{blog.author.name}</p>
            <p className="text-xs text-ink-subtle">{shortDate(blog.createdAt)}</p>
          </div>
          <span className="flex items-center gap-3 text-xs tabular-nums text-ink-subtle">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" aria-hidden />
              {blog.likeCount}
              <span className="sr-only">likes</span>
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              {blog.commentCount}
              <span className="sr-only">comments</span>
            </span>
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
