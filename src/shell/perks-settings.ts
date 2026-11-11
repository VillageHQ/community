import "server-only";

import { perksManifest } from "@/modules/perks/manifest";
import { readPerksUrl, removePerksEmbed, savePerksEmbed } from "@/modules/perks/service";
import { isDemoMode } from "@/platform/demo/mode";
import type { RequestContext } from "@/platform/http/request-context";

import { readEnabledIds } from "./enabled-modules";
import { setModuleState } from "./module-settings";

// Set up › Perks (Founderhall's page): the embed code and "Show Perks to members". The switch is the Perks module's own
// on/off, so the menu entry, the Today card and /perks follow it. Members see Perks only with a marketplace saved
// (the demo shows its made-up deals without one).
async function showPerks(context: RequestContext, isOn: boolean) {
  const isOnNow = (await readEnabledIds(context.database)).has(perksManifest.id);
  if (isOnNow !== isOn) await setModuleState(context, { moduleId: perksManifest.id, isOn });
}

export async function savePerksSettings(context: RequestContext, { code, isShown }: { code: string; isShown: boolean }) {
  if (code.trim()) await savePerksEmbed(context, code);
  const url = await readPerksUrl(context.database);
  await showPerks(context, isShown && (url !== null || isDemoMode(context.environment)));
  return url;
}

export async function removePerksMarketplace(context: RequestContext) {
  await removePerksEmbed(context);
  if (!isDemoMode(context.environment)) await showPerks(context, false);
}
