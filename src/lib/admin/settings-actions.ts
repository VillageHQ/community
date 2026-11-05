import "server-only";

import { saveBranding, saveLogo, deleteLogo, type BrandingFields, type LogoFile } from "../../platform/branding/branding.ts";
import type { NetworkContext } from "../../platform/http/request-context.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";

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
