import { authClient } from "./auth-client.ts";
import { ROUTES } from "./routes.ts";
import { clearVillageBrowserSession } from "./village/browser-session.ts";

export async function signOutAndGoTo(path: string) {
  await authClient.signOut();
  clearVillageBrowserSession();
  window.location.assign(path);
}

export function signOut() {
  return signOutAndGoTo(ROUTES.signIn);
}
