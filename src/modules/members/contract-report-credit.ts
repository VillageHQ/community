import { z } from "zod";

export const reportCreditBodySchema = z.object({ isOn: z.boolean() });

export const reportCreditSchema = z.object({ isOn: z.boolean() });
