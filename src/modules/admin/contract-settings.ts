import { z } from "zod";

import { MAXIMUM_COMMUNITY_NAME_LENGTH, MAXIMUM_DESCRIPTOR_LENGTH } from "../../platform/branding/branding-api.ts";
import { parseAccentColor } from "../../platform/design/accent.ts";
import { API_ROUTES } from "../../platform/http/routes.ts";
import { MAXIMUM_DATA_CONTACT_NAME_LENGTH, MAXIMUM_DATA_LOCATION_LENGTH } from "../../platform/settings/data-home-api.ts";
import { HOSTED_BY, isDay, PLANS } from "../../platform/settings/plan-api.ts";

// Set up › Settings: one form, one save (Founderhall's settingsPage). Every field is a string; an empty one means
// "not set". Errors come back per field, so the page shows each under its field and the flash says a fix is needed.
export const SETTINGS_API_ROUTE = `${API_ROUTES.branding}/settings`;

export const SETTINGS_FIELDS = {
  name: "name",
  descriptor: "descriptor",
  logoUrl: "logoUrl",
  accent: "accent",
  fromName: "fromName",
  mailDomain: "mailDomain",
  hostingBy: "hostingBy",
  region: "region",
  contactName: "contactName",
  contactEmail: "contactEmail",
  messagePolicy: "messagePolicy",
  plan: "plan",
  managedSetupBy: "managedSetupBy",
} as const;

export type SettingsField = (typeof SETTINGS_FIELDS)[keyof typeof SETTINGS_FIELDS];
export type SettingsValues = Record<SettingsField, string>;

export const MESSAGE_POLICY_DEFAULTS = { anyone: "anyone", introduced: "introduced" } as const;

const MAXIMUM_LOGO_URL_LENGTH = 500;
const MAXIMUM_FROM_NAME_LENGTH = 80;
const MAXIMUM_DOMAIN_LENGTH = 120;
const MAXIMUM_EMAIL_LENGTH = 254;
const DOMAIN_SHAPE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Line breaks and invisible characters change what members read; they are refused.
const HIDDEN_CHARACTERS = /(?![‌‍])[\p{Cc}\p{Cf}]/u;

export const settingsBodySchema = z.object(
  Object.fromEntries(Object.values(SETTINGS_FIELDS).map((field) => [field, z.string().max(2_000).default("")])) as Record<SettingsField, z.ZodDefault<z.ZodString>>,
);

export const settingsResponseSchema = z.object({ saved: z.boolean(), errors: z.record(z.string(), z.string()).default({}) });

function isLogoAddress(text: string) {
  if (text.startsWith("/")) return !text.startsWith("//") && !/[\s\\]/.test(text);
  try {
    const address = new URL(text);
    return address.protocol === "https:" && !address.username && !address.password;
  } catch {
    return false;
  }
}

// The values as they will be saved (trimmed), and what is wrong with any of them.
export function checkSettings(raw: SettingsValues): { values: SettingsValues; errors: Partial<Record<SettingsField, string>> } {
  const values = Object.fromEntries(Object.entries(raw).map(([field, value]) => [field, value.trim()])) as SettingsValues;
  values.mailDomain = values.mailDomain.toLowerCase().replace(/\.$/, "");
  values.contactEmail = values.contactEmail.toLowerCase();
  const errors: Partial<Record<SettingsField, string>> = {};
  for (const [field, value] of Object.entries(values) as [SettingsField, string][]) {
    if (HIDDEN_CHARACTERS.test(value)) errors[field] = "Use plain text on one line.";
  }
  if (!values.name) errors.name = "Enter your community’s name.";
  else if (values.name.length > MAXIMUM_COMMUNITY_NAME_LENGTH) errors.name = `Keep the name under ${MAXIMUM_COMMUNITY_NAME_LENGTH} characters.`;
  if (values.descriptor.length > MAXIMUM_DESCRIPTOR_LENGTH) errors.descriptor = `Keep the descriptor under ${MAXIMUM_DESCRIPTOR_LENGTH} characters.`;
  if (values.logoUrl && (values.logoUrl.length > MAXIMUM_LOGO_URL_LENGTH || !isLogoAddress(values.logoUrl))) errors.logoUrl = "Use an https:// address or a path on this server.";
  if (values.accent && parseAccentColor(values.accent) === null) errors.accent = "Use a colour like #24525A.";
  if (values.fromName.length > MAXIMUM_FROM_NAME_LENGTH) errors.fromName = `Keep the from name under ${MAXIMUM_FROM_NAME_LENGTH} characters.`;
  if (values.mailDomain && (values.mailDomain.length > MAXIMUM_DOMAIN_LENGTH || !DOMAIN_SHAPE.test(values.mailDomain))) errors.mailDomain = "Use a domain like mail.fund.example.";
  if (values.hostingBy !== HOSTED_BY.managed) values.hostingBy = HOSTED_BY.ourselves;
  if (values.region.length > MAXIMUM_DATA_LOCATION_LENGTH) errors.region = `Keep the region under ${MAXIMUM_DATA_LOCATION_LENGTH} characters.`;
  if (values.contactName.length > MAXIMUM_DATA_CONTACT_NAME_LENGTH) errors.contactName = `Keep the name or role under ${MAXIMUM_DATA_CONTACT_NAME_LENGTH} characters.`;
  if (values.contactEmail && (values.contactEmail.length > MAXIMUM_EMAIL_LENGTH || !EMAIL_SHAPE.test(values.contactEmail))) errors.contactEmail = "Use an email address like privacy@fund.example.";
  if (values.contactName && !values.contactEmail && !errors.contactName) errors.contactEmail = "Add an email for data requests, or clear the name.";
  if (values.messagePolicy !== MESSAGE_POLICY_DEFAULTS.introduced) values.messagePolicy = MESSAGE_POLICY_DEFAULTS.anyone;
  if (values.plan !== PLANS.managed && values.plan !== PLANS.selfHost) values.plan = "";
  if (values.managedSetupBy && !isDay(values.managedSetupBy)) errors.managedSetupBy = "Use a date, or leave it empty.";
  return { values, errors };
}
