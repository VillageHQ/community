import { z } from "zod";

export const MODULE_ERROR_CODES = {
  notFound: "module_not_found",
  alwaysOn: "module_always_on",
  requirementOff: "module_requirement_off",
} as const;

export const moduleStateBodySchema = z.object({ moduleId: z.string().min(1), isOn: z.boolean() });

export type ModuleStateBody = z.infer<typeof moduleStateBodySchema>;
