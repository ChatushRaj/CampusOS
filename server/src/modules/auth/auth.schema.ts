import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'That password is too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password,
  rollNumber: z.string().trim().max(24).optional().or(z.literal('')),
  department: z.string().trim().max(80).optional().or(z.literal('')),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  // Required only when claiming a faculty or admin account.
  role: z.enum(['student', 'faculty', 'admin']).default('student'),
  inviteCode: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
