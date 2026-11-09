export const SETUP_STEPS = { brand: "brand", keys: "keys", group: "group", invite: "invite", report: "report" } as const;

export type SetupStepId = (typeof SETUP_STEPS)[keyof typeof SETUP_STEPS];
