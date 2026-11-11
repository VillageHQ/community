import "server-only";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { readBranding, saveBranding } from "../../platform/branding/branding.ts";
import type { Database } from "../../platform/database/client.ts";
import { DEFAULT_ACCENT_COLOR, parseAccentColor } from "../../platform/design/accent.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { readDataHome, toDataHomeSettings } from "../../platform/settings/data-home.ts";
import { readPlanSettings } from "../../platform/settings/plan.ts";
import { INSTANCE_SETTING_KEYS } from "../../platform/settings/schema.ts";
import { readSettings, saveSettings } from "../../platform/settings/store.ts";
import { MESSAGE_POLICY_DEFAULTS, type SettingsField, type SettingsValues } from "./contract-settings.ts";

const PLAIN_KEYS = {
  logoUrl: INSTANCE_SETTING_KEYS.logoUrl,
  fromName: INSTANCE_SETTING_KEYS.mailFromName,
  mailDomain: INSTANCE_SETTING_KEYS.mailDomain,
  hostingBy: INSTANCE_SETTING_KEYS.hostingBy,
  messagePolicy: INSTANCE_SETTING_KEYS.messagePolicyDefault,
  plan: INSTANCE_SETTING_KEYS.plan,
  managedSetupBy: INSTANCE_SETTING_KEYS.managedSetupBy,
} as const satisfies Partial<Record<SettingsField, string>>;

// What Set up › Settings shows: the saved values, as the form's strings.
export async function readSettingsValues(database: Database): Promise<SettingsValues & { isBrandSaved: boolean }> {
  const [branding, dataHome, plan, settings] = await Promise.all([readBranding(database), readDataHome(database), readPlanSettings(database), readSettings(database, Object.values(PLAIN_KEYS))]);
  return {
    isBrandSaved: branding.isSaved,
    name: branding.name,
    descriptor: branding.descriptor,
    logoUrl: settings.get(PLAIN_KEYS.logoUrl) ?? "",
    accent: branding.accentColor.toUpperCase(),
    fromName: settings.get(PLAIN_KEYS.fromName) ?? "",
    mailDomain: settings.get(PLAIN_KEYS.mailDomain) ?? "",
    hostingBy: plan.hostedBy,
    region: dataHome.location ?? "",
    contactName: dataHome.contact?.name ?? "",
    contactEmail: dataHome.contact?.email ?? "",
    messagePolicy: settings.get(PLAIN_KEYS.messagePolicy) === MESSAGE_POLICY_DEFAULTS.introduced ? MESSAGE_POLICY_DEFAULTS.introduced : MESSAGE_POLICY_DEFAULTS.anyone,
    plan: plan.savedPlan,
    managedSetupBy: plan.managedSetupBy,
  };
}

// One save for the whole page, in one transaction with its audit entry (which names the fields that changed).
export async function saveCommunitySettings({ database, member }: RequestContext, values: SettingsValues) {
  const before = await readSettingsValues(database);
  const changed = (Object.keys(values) as SettingsField[]).filter((field) => values[field] !== before[field] && !(field === "accent" && values.accent.toUpperCase() === before.accent));
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveBranding(transaction, { name: values.name, descriptor: values.descriptor, accentColor: parseAccentColor(values.accent) ?? DEFAULT_ACCENT_COLOR });
    await saveSettings(transaction, {
      ...Object.fromEntries(Object.entries(PLAIN_KEYS).map(([field, key]) => [key, values[field as keyof typeof PLAIN_KEYS]])),
      ...toDataHomeSettings({ location: values.region, contactName: values.contactName, contactEmail: values.contactEmail }),
    });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.settingsSaved, detail: changed.length > 0 ? changed.join(", ") : null });
  });
}
