import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/layout/Logo';

export function NotFound() {
  useDocumentTitle('Page not found');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <p className="eyebrow mt-10">Error 404</p>
      <h1 className="mt-3 font-display text-display-md font-semibold text-ink">This page does not exist</h1>
      <p className="mt-3 max-w-md text-ink-muted">
        The link may be out of date, or the item was removed. Everything else is still where you left it.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/app">Go to your dashboard</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/app/feed">Open the feed</Link>
        </Button>
      </div>
    </div>
  );
}
