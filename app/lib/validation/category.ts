import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Keep it under 50 characters"),
});

export type CategoryInput = z.infer<typeof categorySchema>;
