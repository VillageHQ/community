import "server-only";

import { saveBranding, saveLogo, deleteLogo, type BrandingFields, type LogoFile } from "../branding/branding.ts";
import type { NetworkContext } from "../village/member-network.ts";
import { saveConfirmedVillageDomain, saveDailyLookupLimit } from "../village/settings.ts";
import { AUDIT_ACTIONS } from "./admin-api.ts";
import { withAdminTransaction } from "./admin-transaction.ts";
import { recordAdminAction } from "./audit.ts";

export function setDailyLookupLimit({ database, member }: NetworkContext, limit: number) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveDailyLookupLimit(transaction, limit);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.dailyLimitChanged, detail: String(limit) });
  });
}

export function confirmVillageDomain({ database, member }: NetworkContext, domain: string) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveConfirmedVillageDomain(transaction, domain);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.domainConfirmed, detail: domain });
  });
}

export function saveBrandingAsAdmin({ database, member }: NetworkContext, fields: BrandingFields) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveBranding(transaction, fields);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.brandingSaved });
  });
}

export function saveLogoAsAdmin({ database, member }: NetworkContext, logo: LogoFile) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveLogo(transaction, logo);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.logoSaved });
  });
}

export function deleteLogoAsAdmin({ database, member }: NetworkContext) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await deleteLogo(transaction);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.logoRemoved });
  });
}
