import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    email: z.string().email().toLowerCase().optional(),
    password: z.string().min(6).max(72).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.email !== undefined || v.password !== undefined,
    { message: 'Provide at least one field to update' },
  );

export const listUsersQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
