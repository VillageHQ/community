import "server-only";

import type { DatabaseOrTransaction } from "../database/client.ts";
import type { RequestContext } from "../http/request-context.ts";
import { AUDIT_ACTIONS } from "../audit/actions.ts";
import { withAdminTransaction } from "../audit/admin-transaction.ts";
import { recordAdminAction } from "../audit/record.ts";
import { toDataHome, type DataHome, type DataHomeBody } from "./data-home-api.ts";
import { INSTANCE_SETTING_KEYS } from "./schema.ts";
import { readSettings, saveSettings } from "./store.ts";

const KEYS = {
  location: INSTANCE_SETTING_KEYS.dataLocation,
  contactName: INSTANCE_SETTING_KEYS.dataContactName,
  contactEmail: INSTANCE_SETTING_KEYS.dataContactEmail,
} as const;

export async function readDataHome(database: DatabaseOrTransaction): Promise<DataHome> {
  const settings = await readSettings(database, Object.values(KEYS));
  return toDataHome({
    location: settings.get(KEYS.location) ?? "",
    contactName: settings.get(KEYS.contactName) ?? "",
    contactEmail: settings.get(KEYS.contactEmail) ?? "",
  });
}

export function toDataHomeSettings({ location, contactName, contactEmail }: DataHomeBody) {
  return { [KEYS.location]: location, [KEYS.contactName]: contactName, [KEYS.contactEmail]: contactEmail };
}

export function saveDataHomeAsAdmin({ database, member }: RequestContext, body: DataHomeBody) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, toDataHomeSettings(body));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.dataHomeSaved });
  });
}
