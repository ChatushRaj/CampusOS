import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { RequireAnonymous, RequireAuth, RequireRole } from '@/components/layout/Guards';
import { AppLayout } from '@/components/layout/AppLayout';

// Route-level code splitting: the landing page does not pull in the chart bundle.
const Landing = lazy(() => import('@/pages/Landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('@/pages/Register').then((m) => ({ default: m.Register })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Feed = lazy(() => import('@/pages/Feed').then((m) => ({ default: m.Feed })));
const PostDetail = lazy(() => import('@/pages/PostDetail').then((m) => ({ default: m.PostDetail })));
const Blogs = lazy(() => import('@/pages/Blogs').then((m) => ({ default: m.Blogs })));
const BlogDetail = lazy(() => import('@/pages/BlogDetail').then((m) => ({ default: m.BlogDetail })));
const Notices = lazy(() => import('@/pages/Notices').then((m) => ({ default: m.Notices })));
const Events = lazy(() => import('@/pages/Events').then((m) => ({ default: m.Events })));
const Jobs = lazy(() => import('@/pages/Jobs').then((m) => ({ default: m.Jobs })));
const JobDetail = lazy(() => import('@/pages/JobDetail').then((m) => ({ default: m.JobDetail })));
const Marketplace = lazy(() => import('@/pages/Marketplace').then((m) => ({ default: m.Marketplace })));
const ListingDetail = lazy(() => import('@/pages/ListingDetail').then((m) => ({ default: m.ListingDetail })));
const People = lazy(() => import('@/pages/People').then((m) => ({ default: m.People })));
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));
const Bookmarks = lazy(() => import('@/pages/Bookmarks').then((m) => ({ default: m.Bookmarks })));
const Groups = lazy(() => import('@/pages/Groups').then((m) => ({ default: m.Groups })));
const Reports = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading page</span>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />

                <Route element={<RequireAnonymous />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>

                <Route element={<RequireAuth />}>
                  <Route path="/app" element={<AppLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="feed" element={<Feed />} />
                    <Route path="posts/:id" element={<PostDetail />} />
                    <Route path="blogs" element={<Blogs />} />
                    <Route path="blogs/:id" element={<BlogDetail />} />
                    <Route path="notices" element={<Notices />} />
                    <Route path="events" element={<Events />} />
                    <Route path="jobs" element={<Jobs />} />
                    <Route path="jobs/:id" element={<JobDetail />} />
                    <Route path="marketplace" element={<Marketplace />} />
                    <Route path="marketplace/:id" element={<ListingDetail />} />
                    <Route path="groups" element={<Groups />} />
                    <Route path="people" element={<People />} />
                    <Route path="people/:id" element={<Profile />} />
                    <Route path="bookmarks" element={<Bookmarks />} />
                    <Route path="settings" element={<Settings />} />

                    {/* Administrators only; the guard runs on the server too. */}
                    <Route element={<RequireRole roles={['admin']} />}>
                      <Route path="reports" element={<Reports />} />
                    </Route>
                  </Route>
                </Route>

                {/* Legacy paths from earlier iterations keep working. */}
                <Route path="/dashboard/*" element={<Navigate to="/app" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>

            <Toaster
              position="bottom-right"
              closeButton
              toastOptions={{
                className: 'font-sans',
                style: {
                  background: 'hsl(var(--surface))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--ink))',
                },
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
