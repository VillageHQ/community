// Who asked whom, in the console. Community's rule: admins see intro states, dates and counts, never who asked whom.
// The Intro log, Home's "Latest in the intro log" and the partner report keep Founderhall's layout either way; with
// this off, every name in them reads as a placeholder and the reads never load a name.
// THE OWNER'S DECISION IS PENDING. Switching admins to names is this one line.
export const ADMIN_SEES_INTRO_NAMES = false;

// What a hidden name reads as in the console.
export const HIDDEN_INTRO_NAMES = { asker: "A member", target: "Someone", connector: "A member" } as const;
