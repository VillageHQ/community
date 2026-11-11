import "server-only";

import type { Database } from "../platform/database/client.ts";
import type { Environment } from "../platform/environment.ts";
import { readBranding } from "../platform/branding/branding.ts";
import { readMailSettings } from "../platform/email/mail-settings.ts";
import { readResendConfig } from "../platform/email/resend.ts";
import { ROUTES } from "../platform/http/routes.ts";
import { MODULE_KINDS } from "../platform/modules/manifest.ts";
import { PLANS, readPlanSettings } from "../platform/settings/plan.ts";
import { readVillageKeys } from "../platform/village/settings.ts";
import { readOpenReportCount } from "../modules/admin/service-reports.ts";
import { CHAT_ADMIN_PAGE } from "../modules/chat/contract.ts";
import { chatManifest } from "../modules/chat/manifest.ts";
import { readChatConnections } from "../modules/chat/service.ts";
import { networkManifest } from "../modules/network/manifest.ts";
import { PERKS_ADMIN_PAGE } from "../modules/perks/contract.ts";
import { perksManifest } from "../modules/perks/manifest.ts";
import { readPerksUrl } from "../modules/perks/service.ts";
import { MODULES } from "../modules/registry.ts";
import { readEnabledIds } from "./enabled-modules.ts";

// Set up (Founderhall's setupPage): the plumbing pages in one place, each with one plain line and whether it is set
// up. A state is "done" (Set up), "todo" (Not yet), "needs" (a count that needs a look) or a small word of its own.
export const SETUP_ROW_STATES = { done: "done", todo: "todo", needs: "needs", word: "word" } as const;

export type SetupRowState =
  | { kind: typeof SETUP_ROW_STATES.done }
  | { kind: typeof SETUP_ROW_STATES.todo }
  | { kind: typeof SETUP_ROW_STATES.needs; text: string }
  | { kind: typeof SETUP_ROW_STATES.word; text: string };

export type SetupRow = { key: string; title: string; href: string; description: string; state: SetupRowState };

export type SetupFacts = {
  isBrandSaved: boolean;
  isMailOn: boolean;
  hasSendingDomain: boolean;
  isNetworkOn: boolean;
  hasVillageKeys: boolean;
  isChatOn: boolean;
  isChatPosting: boolean;
  isPerksOn: boolean;
  isPerksShown: boolean;
  featuresOn: number;
  openReports: number;
};

const done = { kind: SETUP_ROW_STATES.done } as const;
const todo = { kind: SETUP_ROW_STATES.todo } as const;
const word = (text: string) => ({ kind: SETUP_ROW_STATES.word, text }) as const;
const isDone = (isSet: boolean) => (isSet ? done : todo);
const OFF = word("off");
const OPTIONAL = word("optional");

export function readSetupRows(facts: SetupFacts): SetupRow[] {
  return [
    {
      key: "settings",
      title: "Settings",
      href: ROUTES.adminSettings,
      description: "Your fund’s name, colour and logo, your plan, and who members write to about their data.",
      state: isDone(facts.isBrandSaved),
    },
    {
      key: "mail",
      title: "Mail",
      href: ROUTES.adminMail,
      description: "Invites, sign-in links and the weekly digest go out from your own domain.",
      state: isDone(facts.isMailOn && facts.hasSendingDomain),
    },
    {
      key: "village",
      title: "Village",
      // A switched-off feature's page answers 404, so its row leads to the switch.
      href: facts.isNetworkOn ? ROUTES.adminVillage : ROUTES.adminFeatures,
      description: "Fills in profiles and finds who in your members’ networks can introduce whom.",
      state: facts.isNetworkOn ? isDone(facts.hasVillageKeys) : OFF,
    },
    {
      key: "import",
      title: "Import members",
      href: ROUTES.adminImport,
      description: "Bring a whole alumni list in from a spreadsheet (CSV), in one upload.",
      state: OPTIONAL,
    },
    {
      key: "links",
      title: "Sign-in links",
      href: ROUTES.adminLinks,
      description: facts.isMailOn
        ? "Mail is on, so links are emailed. Links whose email failed wait here to copy."
        : "While mail is off, invite and sign-in links wait here for you to copy and send.",
      state: word(facts.isMailOn ? "not needed" : "in use"),
    },
    {
      key: "integrations",
      title: "Integrations",
      href: facts.isChatOn ? CHAT_ADMIN_PAGE : ROUTES.adminFeatures,
      description: "New asks and a weekly line in your Slack or Discord; /ask from Slack.",
      state: !facts.isChatOn ? OFF : facts.isChatPosting ? done : OPTIONAL,
    },
    {
      key: "perks",
      title: "Perks",
      href: facts.isPerksOn ? PERKS_ADMIN_PAGE : ROUTES.adminFeatures,
      description: "A perks page for your founders, from your BuiltFirst marketplace.",
      state: !facts.isPerksOn ? OFF : facts.isPerksShown ? done : OPTIONAL,
    },
    {
      key: "audit",
      title: "Audit log",
      href: ROUTES.adminAuditLog,
      description: "Every admin action, sign-in and privacy change, newest first.",
      state: word("always on"),
    },
    // Community's own pages, in the same list.
    {
      key: "features",
      title: "Features",
      href: ROUTES.adminFeatures,
      description: "Switch parts of the portal on or off. Turning one off hides it and keeps its data.",
      state: word(`${facts.featuresOn} on`),
    },
    {
      key: "reports",
      title: "Reports",
      href: ROUTES.adminReports,
      description: "What members flagged. Only admins see it, and nobody is told who reported.",
      state: facts.openReports > 0 ? { kind: SETUP_ROW_STATES.needs, text: `${facts.openReports} open` } : word("none open"),
    },
  ];
}

export function readSetupLede(communityName: string, isManaged: boolean) {
  return `The plumbing behind ${communityName}.${isManaged ? " On the managed plan Village sets up mail and the network for you: nothing to paste." : " Each page says in plain words what it needs."}`;
}

export async function readSetupPage(database: Database, environment: Environment) {
  const enabledIds = await readEnabledIds(database);
  const isNetworkOn = enabledIds.has(networkManifest.id);
  const isChatOn = enabledIds.has(chatManifest.id);
  const isPerksOn = enabledIds.has(perksManifest.id);
  const [branding, mail, plan, keys, chats, perksUrl, openReports] = await Promise.all([
    readBranding(database),
    readMailSettings(database),
    readPlanSettings(database),
    isNetworkOn ? readVillageKeys(database, environment) : null,
    isChatOn ? readChatConnections(database) : [],
    isPerksOn ? readPerksUrl(database) : null,
    readOpenReportCount(database),
  ]);
  const config = readResendConfig(environment);
  const facts: SetupFacts = {
    isBrandSaved: branding.isSaved,
    isMailOn: config !== null,
    hasSendingDomain: Boolean(mail.domain) || /@[^>\s]+/.test(config?.fromAddress ?? ""),
    isNetworkOn,
    hasVillageKeys: keys !== null,
    isChatOn,
    isChatPosting: chats.some(({ channelId, isPaused }) => Boolean(channelId) && !isPaused),
    isPerksOn,
    isPerksShown: perksUrl !== null,
    featuresOn: MODULES.filter(({ manifest }) => manifest.kind === MODULE_KINDS.toggleable && enabledIds.has(manifest.id)).length,
    openReports,
  };
  return { lede: readSetupLede(branding.name, plan.plan === PLANS.managed), rows: readSetupRows(facts) };
}
