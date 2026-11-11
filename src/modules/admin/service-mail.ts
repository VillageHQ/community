import "server-only";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { checkSendingDomain, readParentDomain, type TxtResolver } from "../../platform/email/dns-check.ts";
import { DEFAULT_DKIM_SELECTOR, MAIL_DNS_CHECK_KEY, readMailDomain, readMailReplyDomain, readMailSettings } from "../../platform/email/mail-settings.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { INSTANCE_SETTING_KEYS } from "../../platform/settings/schema.ts";
import { saveSettings } from "../../platform/settings/store.ts";
import { readReplyDomain } from "../../platform/weekly-email/tokens.ts";
import type { MailSettingsBody } from "./contract-mail.ts";

// Check DNS now: the sending domain (Settings' one, else the host's sender's) with the saved DKIM selector, and the
// reply domain's MX. Null when no domain is known yet. The result is kept for Settings' mail checklist.
export async function checkMailDns({ database, environment, member }: RequestContext, resolver?: TxtResolver) {
  const settings = await readMailSettings(database);
  const domain = readMailDomain(readResendConfig(environment)?.fromAddress ?? null, settings);
  if (!domain) return null;
  const replyDomain = readMailReplyDomain(domain, readReplyDomain(environment), settings, readParentDomain);
  const check = await checkSendingDomain(domain, resolver, new Date(), { dkimSelector: settings.dkimSelector || DEFAULT_DKIM_SELECTOR, replyDomain });
  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, { [MAIL_DNS_CHECK_KEY]: JSON.stringify(check) });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.mailDnsChecked, detail: domain });
  });
  return check;
}

export function saveMailSettings({ database, member }: RequestContext, { dkimSelector, replyDomain }: MailSettingsBody) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, { [INSTANCE_SETTING_KEYS.mailDkimSelector]: dkimSelector, [INSTANCE_SETTING_KEYS.mailReplyDomain]: replyDomain });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.mailSettingsSaved });
  });
}
