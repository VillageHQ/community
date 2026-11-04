import { z } from "zod";

import { parseAccentColor } from "../design/accent.ts";

export const MAXIMUM_COMMUNITY_NAME_LENGTH = 60;
export const MAXIMUM_DESCRIPTOR_LENGTH = 80;

export const brandingBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your community's name.")
    .max(MAXIMUM_COMMUNITY_NAME_LENGTH, `Keep the name under ${MAXIMUM_COMMUNITY_NAME_LENGTH} characters.`),
  descriptor: z
    .string()
    .trim()
    .max(MAXIMUM_DESCRIPTOR_LENGTH, `Keep the descriptor under ${MAXIMUM_DESCRIPTOR_LENGTH} characters.`),
  accentColor: z
    .string()
    .refine((color) => parseAccentColor(color) !== null, "Use a six-digit hex color, like #0f7f86.")
    .transform((color) => color.toLowerCase()),
});
