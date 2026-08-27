import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/layout/PageHeader';
import type { CurrentUser } from '@/types';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600).optional(),
  department: z.string().trim().max(80).optional(),
  rollNumber: z.string().trim().max(24).optional(),
  graduationYear: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Both passwords must match',
    path: ['confirmPassword'],
  });

const feedbackSchema = z.object({
  subject: z.string().trim().min(4, 'Summarise the issue').max(140),
  body: z.string().trim().min(10, 'Tell us a little more').max(3000),
  category: z.enum(['bug', 'suggestion', 'content', 'other']),
});

function InterestsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const tag = draft.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= 12) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="robotics"
          aria-label="Add an interest"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={value.length >= 12}>
          Add
        </Button>
      </div>
      <p className="mt-1 text-xs text-ink-subtle">{value.length} of 12 · press Enter to add</p>

      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((interest) => (
            <li key={interest}>
              <Badge tone="primary" size="md">
                {interest}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((i) => i !== interest))}
                  aria-label={`Remove ${interest}`}
                  className="ml-0.5 rounded-full hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Settings() {
  useDocumentTitle('Settings');
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [uploading, setUploading] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      headline: user?.headline ?? '',
      bio: user?.bio ?? '',
      department: user?.department ?? '',
      rollNumber: user?.rollNumber ?? '',
      graduationYear: user?.graduationYear ? String(user.graduationYear) : '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const feedbackForm = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { category: 'bug' },
  });

  const saveProfile = useMutation({
    mutationFn: (values: z.infer<typeof profileSchema>) =>
      api.patch<{ user: CurrentUser }>('/api/users/me', {
        ...values,
        graduationYear: values.graduationYear ? Number(values.graduationYear) : null,
        interests,
      }),
    onSuccess: (result) => {
      updateUser(result.user);
      toast.success('Profile updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePassword = useMutation({
    mutationFn: (values: z.infer<typeof passwordSchema>) =>
      api.post('/api/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      toast.success('Password changed. Other devices have been signed out.');
      passwordForm.reset();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendFeedback = useMutation({
    mutationFn: (values: z.infer<typeof feedbackSchema>) => api.post('/api/feedback', values),
    onSuccess: () => {
      toast.success('Thanks — your report reached the campus team.');
      feedbackForm.reset();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAvatar = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Images must be smaller than 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.set('avatar', file);
      const payload = await api.upload<{ user: CurrentUser }>('/api/users/me/avatar', data, 'PATCH');
      updateUser(payload.user);
      toast.success('Photo updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <PageHeader title="Settings" description="Your profile, password and support requests." />

      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Password</TabsTrigger>
          <TabsTrigger value="support">Help and support</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'profile' && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-display text-base font-semibold text-ink">Your profile</h2>
            <p className="mt-1 text-sm text-ink-muted">This is what other people on campus see.</p>
          </CardHeader>
          <CardBody>
            <div className="mb-6 flex items-center gap-4">
              <Avatar name={user?.name ?? ''} src={user?.avatarUrl} size="xl" />
              <div>
                <label
                  htmlFor="avatar"
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-ink-muted transition-colors hover:border-ink-subtle/50 hover:text-ink',
                    uploading && 'pointer-events-none opacity-60',
                  )}
                >
                  <Camera className="h-4 w-4" aria-hidden />
                  {uploading ? 'Uploading…' : 'Change photo'}
                </label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
                <p className="mt-1.5 text-xs text-ink-subtle">JPG, PNG or WebP, up to 5 MB.</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={profileForm.handleSubmit((v) => saveProfile.mutate(v))}>
              <Field label="Full name" error={profileForm.formState.errors.name?.message} required>
                {({ id, invalid }) => <Input id={id} invalid={invalid} {...profileForm.register('name')} />}
              </Field>

              <Field label="Headline" hint="One line that appears under your name.">
                {({ id }) => (
                  <Input
                    id={id}
                    placeholder="Third year · backend and databases"
                    {...profileForm.register('headline')}
                  />
                )}
              </Field>

              <Field label="About you" error={profileForm.formState.errors.bio?.message}>
                {({ id }) => <Textarea id={id} rows={4} {...profileForm.register('bio')} />}
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Department">
                  {({ id }) => <Input id={id} {...profileForm.register('department')} />}
                </Field>
                <Field label="Roll number">
                  {({ id }) => <Input id={id} {...profileForm.register('rollNumber')} />}
                </Field>
                <Field label="Graduating in">
                  {({ id }) => (
                    <select
                      id={id}
                      className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink"
                      {...profileForm.register('graduationYear')}
                    >
                      <option value="">Not set</option>
                      {Array.from({ length: 8 }, (_, i) => currentYear + i - 2).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Interests</p>
                <InterestsEditor value={interests} onChange={setInterests} />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={saveProfile.isPending}>
                  <Check className="h-4 w-4" aria-hidden />
                  Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {tab === 'security' && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-display text-base font-semibold text-ink">Change your password</h2>
            <p className="mt-1 text-sm text-ink-muted">Changing it signs you out everywhere else.</p>
          </CardHeader>
          <CardBody>
            <form className="max-w-md space-y-4" onSubmit={passwordForm.handleSubmit((v) => changePassword.mutate(v))}>
              <Field label="Current password" error={passwordForm.formState.errors.currentPassword?.message} required>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="current-password"
                    invalid={invalid}
                    {...passwordForm.register('currentPassword')}
                  />
                )}
              </Field>
              <Field label="New password" error={passwordForm.formState.errors.newPassword?.message} required>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    invalid={invalid}
                    {...passwordForm.register('newPassword')}
                  />
                )}
              </Field>
              <Field
                label="Confirm new password"
                error={passwordForm.formState.errors.confirmPassword?.message}
                required
              >
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    invalid={invalid}
                    {...passwordForm.register('confirmPassword')}
                  />
                )}
              </Field>
              <Button type="submit" loading={changePassword.isPending}>
                Change password
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {tab === 'support' && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-display text-base font-semibold text-ink">Report a problem</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Something broken, a suggestion, or content that should not be here — it all reaches the campus team.
            </p>
          </CardHeader>
          <CardBody>
            <form className="max-w-lg space-y-4" onSubmit={feedbackForm.handleSubmit((v) => sendFeedback.mutate(v))}>
              <Field label="What kind of report is this?">
                {({ id }) => (
                  <select
                    id={id}
                    className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink"
                    {...feedbackForm.register('category')}
                  >
                    <option value="bug">Something is broken</option>
                    <option value="suggestion">A suggestion</option>
                    <option value="content">Report content</option>
                    <option value="other">Something else</option>
                  </select>
                )}
              </Field>
              <Field label="Subject" error={feedbackForm.formState.errors.subject?.message} required>
                {({ id, invalid }) => <Input id={id} invalid={invalid} {...feedbackForm.register('subject')} />}
              </Field>
              <Field label="Details" error={feedbackForm.formState.errors.body?.message} required>
                {({ id, invalid }) => (
                  <Textarea
                    id={id}
                    rows={5}
                    placeholder="What happened, and what did you expect instead?"
                    invalid={invalid}
                    {...feedbackForm.register('body')}
                  />
                )}
              </Field>
              <Button type="submit" loading={sendFeedback.isPending}>
                Send report
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </>
  );
}
