import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, Briefcase, CalendarDays, Megaphone, Newspaper, ShoppingBag, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/layout/Logo';

/**
 * The hero shows the product rather than describing it: a stack of the real card
 * types, each carrying the same type-keyed spine used throughout the application.
 */
const boardPreview = [
  {
    kind: 'notice',
    color: 'text-kind-notice',
    eyebrow: 'Notice · Examination',
    title: 'End semester timetable published',
    meta: 'Posted by Dr. Anita Menon · Pinned',
  },
  {
    kind: 'job',
    color: 'text-kind-job',
    eyebrow: 'Placement · Internship',
    title: 'Backend engineering intern — Northwind Systems',
    meta: '₹25,000 – ₹35,000 · 3 openings · 6 days left',
  },
  {
    kind: 'event',
    color: 'text-kind-event',
    eyebrow: 'Event · Workshop',
    title: 'Systems design: building for scale',
    meta: 'Thu 4 Sep, 4:00 PM · CS Seminar Hall',
  },
  {
    kind: 'blog',
    color: 'text-kind-blog',
    eyebrow: 'Article · 4 min read',
    title: 'What I learned running a database in a hostel room',
    meta: 'Rahul Verma · 34 likes',
  },
];

const capabilities = [
  {
    icon: Megaphone,
    title: 'Notices that expire',
    body: 'Staff post to the board with a category, a priority and an expiry date. Stale notices remove themselves.',
  },
  {
    icon: Briefcase,
    title: 'Placements end to end',
    body: 'Faculty post openings, students apply in one tap, and the poster reviews every application in one place.',
  },
  {
    icon: CalendarDays,
    title: 'Events with real RSVPs',
    body: 'Going or interested, with capacity limits enforced by the server rather than the honour system.',
  },
  {
    icon: Users,
    title: 'A campus directory',
    body: 'Find people by department, year or interest. Connection requests work in both directions without duplicates.',
  },
  {
    icon: Newspaper,
    title: 'Long-form writing',
    body: 'Students and staff publish articles with reading time, tags, likes and threaded discussion.',
  },
  {
    icon: ShoppingBag,
    title: 'A student marketplace',
    body: 'Textbooks, cycles and desk lamps change hands within campus instead of on a group chat nobody can search.',
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="rounded-sm">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
          <div>
            <p className="eyebrow">For students, faculty and administrators</p>
            <h1 className="mt-4 font-display text-display-lg font-semibold text-ink">
              One board for everything on campus.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
              Notices, placements, events, articles and the student marketplace live in one place — with the
              permissions, deadlines and capacity limits actually enforced.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  Create your account
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 font-mono text-xs text-ink-subtle">
              Students self-register · staff accounts need an invite code
            </p>
          </div>

          {/* The thesis: this is what the product contains, rendered as the product renders it. */}
          <div className="space-y-2.5" aria-hidden>
            {boardPreview.map((item, i) => (
              <div
                key={item.title}
                className={`spine ${item.color} animate-fade-up rounded-lg border border-border bg-surface p-4 pl-5 shadow-card`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <p className="eyebrow">{item.eyebrow}</p>
                <p className="mt-1.5 font-display text-[0.9375rem] font-semibold leading-snug text-ink">{item.title}</p>
                <p className="mt-1 font-mono text-xs text-ink-subtle">{item.meta}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-display text-display-md font-semibold text-ink">What it replaces</h2>
            <p className="mt-3 max-w-2xl text-ink-muted">
              Six noticeboards, four group chats and a spreadsheet nobody can find.
            </p>

            <ul className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="rounded-lg border border-border bg-surface p-8 text-center sm:p-12">
            <Bookmark className="mx-auto h-7 w-7 text-primary" aria-hidden />
            <h2 className="mt-4 font-display text-display-sm font-semibold text-ink">Start with your campus feed</h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-muted">
              Register with your college email, set your department and year, and the board fills itself in.
            </p>
            <Button size="lg" className="mt-6" asChild>
              <Link to="/register">
                Create your account
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-sm text-ink-subtle">
            © {new Date().getFullYear()} CampusOS · Designed and built by{' '}
            <span className="font-medium text-ink-muted">Chatush Raj</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
