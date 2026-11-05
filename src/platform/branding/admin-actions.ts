import "server-only";

import { saveBranding, saveLogo, deleteLogo, type BrandingFields, type LogoFile } from "./branding.ts";
import type { RequestContext } from "../http/request-context.ts";
import { AUDIT_ACTIONS } from "../audit/actions.ts";
import { withAdminTransaction } from "../audit/admin-transaction.ts";
import { recordAdminAction } from "../audit/record.ts";

export function saveBrandingAsAdmin({ database, member }: RequestContext, fields: BrandingFields) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveBranding(transaction, fields);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.brandingSaved });
  });
}

export function saveLogoAsAdmin({ database, member }: RequestContext, logo: LogoFile) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveLogo(transaction, logo);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.logoSaved });
  });
}

export function deleteLogoAsAdmin({ database, member }: RequestContext) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await deleteLogo(transaction);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.logoRemoved });
  });
}
