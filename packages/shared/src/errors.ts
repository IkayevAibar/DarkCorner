import { z } from 'zod';

/** Every error response has this shape; `error` is a stable code, `message` is for people. */
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
