export const SETUP_STEPS = { brand: "brand", domain: "domain", keys: "keys", group: "group" } as const;

export type SetupStepId = (typeof SETUP_STEPS)[keyof typeof SETUP_STEPS];
