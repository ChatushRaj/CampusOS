import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface State {
  error: Error | null;
}

/** Catches render errors so one broken screen does not blank the whole application. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="eyebrow">Error</p>
          <h1 className="mt-2 font-display text-display-sm font-semibold">This screen stopped responding</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Reloading usually clears it. If it keeps happening, report it from Help and support.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>
      </div>
    );
  }
}
