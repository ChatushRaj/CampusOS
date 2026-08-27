import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Logo } from '@/components/layout/Logo';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    role: z.enum(['student', 'faculty', 'admin']),
    rollNumber: z.string().trim().max(24).optional(),
    department: z.string().trim().max(80).optional(),
    graduationYear: z.string().optional(),
    inviteCode: z.string().trim().optional(),
  })
  .refine((v) => v.role === 'student' || Boolean(v.inviteCode), {
    message: 'Staff accounts need an invite code',
    path: ['inviteCode'],
  });

type FormValues = z.infer<typeof schema>;

const rules = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v: string) => /[0-9]/.test(v) },
];

export function Register() {
  useDocumentTitle('Create account');
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'student' } });

  const role = watch('role');
  const password = watch('password') ?? '';

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await signUp({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        rollNumber: values.rollNumber || undefined,
        department: values.department || undefined,
        graduationYear: values.graduationYear ? Number(values.graduationYear) : undefined,
        inviteCode: values.inviteCode || undefined,
      });
      navigate('/app', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        // Surface field-level messages from the server on the right inputs.
        if (error.details) {
          for (const [field, message] of Object.entries(error.details)) {
            setError(field as keyof FormValues, { message });
          }
        }
        setFormError(error.message);
      } else {
        setFormError('Could not create your account. Try again.');
      }
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="p-4 sm:p-6">
        <Link to="/" className="inline-block rounded-sm">
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <p className="eyebrow">Get started</p>
          <h1 className="mt-2 font-display text-display-sm font-semibold text-ink">Create your account</h1>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
              >
                {formError}
              </div>
            )}

            <Field label="Full name" error={errors.name?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  autoComplete="name"
                  autoFocus
                  aria-describedby={describedBy}
                  invalid={invalid}
                  {...register('name')}
                />
              )}
            </Field>

            <Field label="Email" error={errors.email?.message} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  placeholder="you@college.edu"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  {...register('email')}
                />
              )}
            </Field>

            <Field label="Password" error={errors.password?.message} required>
              {({ id, describedBy, invalid }) => (
                <>
                  <div className="relative">
                    <Input
                      id={id}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
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
                  {/* Live requirements beat a single error message after submission. */}
                  <ul className="mt-2 grid grid-cols-2 gap-1">
                    {rules.map((rule) => {
                      const met = rule.test(password);
                      return (
                        <li
                          key={rule.label}
                          className={cn(
                            'flex items-center gap-1.5 text-xs transition-colors',
                            met ? 'text-success' : 'text-ink-subtle',
                          )}
                        >
                          <Check className={cn('h-3 w-3 shrink-0', !met && 'opacity-30')} aria-hidden />
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Field>

            <Field label="I am a" error={errors.role?.message} required>
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} {...register('role')}>
                  <option value="student">Student</option>
                  <option value="faculty">Faculty member</option>
                  <option value="admin">Administrator</option>
                </Select>
              )}
            </Field>

            {role !== 'student' && (
              <Field
                label="Staff invite code"
                error={errors.inviteCode?.message}
                hint="Issued by the campus administrator."
                required
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="off"
                    aria-describedby={describedBy}
                    invalid={invalid}
                    {...register('inviteCode')}
                  />
                )}
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department" error={errors.department?.message}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    placeholder="Computer Science"
                    aria-describedby={describedBy}
                    {...register('department')}
                  />
                )}
              </Field>

              {role === 'student' && (
                <Field label="Graduating in" error={errors.graduationYear?.message}>
                  {({ id, describedBy }) => (
                    <Select id={id} aria-describedby={describedBy} {...register('graduationYear')}>
                      <option value="">Select a year</option>
                      {Array.from({ length: 7 }, (_, i) => currentYear + i - 1).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
            </div>

            {role === 'student' && (
              <Field label="Roll number" error={errors.rollNumber?.message} hint="Optional, shown on your profile.">
                {({ id, describedBy }) => (
                  <Input id={id} placeholder="CS22B1042" aria-describedby={describedBy} {...register('rollNumber')} />
                )}
              </Field>
            )}

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
