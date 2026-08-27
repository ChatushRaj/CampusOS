import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Logo } from '@/components/layout/Logo';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      // Return people to wherever they were headed before the redirect.
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      navigate(from ?? '/app', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not sign you in. Try again.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="p-4 sm:p-6">
        <Link to="/" className="inline-block rounded-sm">
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Welcome back</p>
          <h1 className="mt-2 font-display text-display-sm font-semibold text-ink">Sign in to CampusOS</h1>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
              >
                {formError}
              </div>
            )}

            <Field label="Email" error={errors.email?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@college.edu"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  {...register('email')}
                />
              )}
            </Field>

            <Field label="Password" error={errors.password?.message} required>
              {({ id, describedBy, invalid }) => (
                <div className="relative">
                  <Input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-10"
                    aria-describedby={describedBy}
                    invalid={invalid}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-ink-subtle hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            New here?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
