import { z } from 'zod';

export const createColumnSchema = z.object({
  title: z.string().min(1).max(120),
  position: z.number().optional(),
});

export const updateColumnSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  position: z.number().optional(),
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
