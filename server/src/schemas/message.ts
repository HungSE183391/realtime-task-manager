import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const listMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  before: z.string().datetime().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
