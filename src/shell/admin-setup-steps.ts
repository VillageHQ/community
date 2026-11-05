export const SETUP_STEPS = { brand: "brand", domain: "domain", keys: "keys", group: "group", invite: "invite" } as const;

export type SetupStepId = (typeof SETUP_STEPS)[keyof typeof SETUP_STEPS];
