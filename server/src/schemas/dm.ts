import { z } from 'zod';

export const sendDMSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const listDMSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type SendDMInput = z.infer<typeof sendDMSchema>;
