import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useDebounced } from '@/hooks/useDebounced';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

interface SearchResults {
  results: {
    people: { id: number; name: string; headline: string; href: string }[];
    posts: { id: number; title: string; href: string }[];
    blogs: { id: number; title: string; href: string }[];
    jobs: { id: number; title: string; subtitle: string; href: string }[];
    notices: { id: number; title: string; href: string }[];
  };
}

const groups = [
  { key: 'people', label: 'People' },
  { key: 'notices', label: 'Notices' },
  { key: 'jobs', label: 'Placements' },
  { key: 'blogs', label: 'Articles' },
  { key: 'posts', label: 'Posts' },
] as const;

export function SearchBar() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(term);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get<SearchResults>(`/api/search${qs({ q: debounced })}`),
    enabled: debounced.trim().length >= 2,
  });

  // Close on outside click and on Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      // Slash focuses search, the way most content tools behave.
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        containerRef.current?.querySelector('input')?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (href: string) => {
    navigate(href);
    setOpen(false);
    setTerm('');
  };

  const hasResults = data && groups.some((g) => (data.results[g.key] as unknown[]).length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden
      />
      <Input
        type="search"
        value={term}
        placeholder="Search people, notices, roles…"
        aria-label="Search CampusOS"
        className="pl-9 pr-9"
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {term && (
        <button
          type="button"
          onClick={() => setTerm('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-ink-subtle hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && debounced.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[26rem] overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-pop animate-fade-up">
          {isFetching && !data && <p className="px-2 py-3 text-sm text-ink-subtle">Searching…</p>}
          {data && !hasResults && (
            <p className="px-2 py-3 text-sm text-ink-muted">
              Nothing matched “{debounced}”. Try a name, a company or a keyword.
            </p>
          )}
          {data &&
            groups.map((group) => {
              const rows = data.results[group.key] as {
                id: number;
                title?: string;
                name?: string;
                href: string;
                subtitle?: string;
                headline?: string;
              }[];
              if (!rows.length) return null;
              return (
                <div key={group.key} className="mb-1 last:mb-0">
                  <p className="eyebrow px-2 py-1.5">{group.label}</p>
                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => go(row.href)}
                      className={cn(
                        'block w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-ink transition-colors',
                        'hover:bg-border/50 focus-visible:bg-border/50',
                      )}
                    >
                      {row.name ?? row.title}
                      {(row.subtitle ?? row.headline) && (
                        <span className="ml-2 text-xs text-ink-subtle">{row.subtitle ?? row.headline}</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
