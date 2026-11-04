import { SETUP_STEPS, type SetupStepId } from "./admin-setup-steps.ts";

export const SETUP_STEP_COPY: Record<SetupStepId, { title: string; todo: string; done: string; manageLabel: string }> = {
  [SETUP_STEPS.brand]: {
    title: "Brand your community",
    todo: "Add your name, logo and color. Everyone sees them.",
    done: "Your name, logo and color are set.",
    manageLabel: "Edit",
  },
  [SETUP_STEPS.domain]: {
    title: "Register your domain",
    todo: "Tell Village the address of this site.",
    done: "You confirmed you added this site's address in Village.",
    manageLabel: "Review",
  },
  [SETUP_STEPS.keys]: {
    title: "Add your Village keys",
    todo: "They connect this community to Village.",
    done: "Connected. Village accepted your keys.",
    manageLabel: "Manage",
  },
  [SETUP_STEPS.group]: {
    title: "Create the group",
    todo: "This turns on network search for everyone who joins.",
    done: "Members can join from their network page.",
    manageLabel: "Review",
  },
};
