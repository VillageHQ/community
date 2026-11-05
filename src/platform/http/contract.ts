import { z } from "zod";

export const acknowledgedResponseSchema = z.object({ message: z.string() });

export const emptyBodySchema = z.object({});
