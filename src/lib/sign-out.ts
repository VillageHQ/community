import { authClient } from "./auth-client.ts";
import { ROUTES } from "./routes.ts";
import { clearVillageBrowserSession } from "./village/browser-session.ts";

export async function signOut() {
  await authClient.signOut();
  clearVillageBrowserSession();
  window.location.assign(ROUTES.signIn);
}
