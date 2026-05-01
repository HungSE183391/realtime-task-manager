import { z } from 'zod';

export const createBoardSchema = z.object({
  title: z.string().min(1).max(120),
});

export const updateBoardSchema = z.object({
  title: z.string().min(1).max(120),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
