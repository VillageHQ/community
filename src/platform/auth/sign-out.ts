import { authClient } from "./auth-client.ts";
import { ROUTES } from "../http/routes.ts";
import { clearVillageBrowserSession } from "./browser-session.ts";

export async function signOutAndGoTo(path: string) {
  await authClient.signOut();
  clearVillageBrowserSession();
  window.location.assign(path);
}

export function signOut() {
  return signOutAndGoTo(ROUTES.signIn);
}
