import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { alias } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { memberAvatar, memberFillIn, memberProfile } from "./schema.ts";
import { FILL_IN_FIELDS } from "./contract-fill-in.ts";
import { API_ROUTES } from "../../platform/http/routes.ts";

// The pictures every screen draws for a member. Their face: an uploaded photo, else the face public profiles found.
// Their company's logo: only while the company on show is the one public profiles found (rules-fill-in.ts
// isFilledLogoShown is the twin). Each is one subquery, so any read can add it next to the member's id.

const faceLine = alias(memberFillIn, "shown_face_line");
const logoLine = alias(memberFillIn, "shown_logo_line");
const companyLine = alias(memberFillIn, "shown_logo_company");
const ownProfile = alias(memberProfile, "shown_logo_profile");
const ownAvatar = alias(memberAvatar, "shown_face_avatar");
const logoOwner = alias(user, "shown_logo_owner");

export function filledFaceColumn(memberId: AnyPgColumn | SQL) {
  return sql<string | null>`(select ${faceLine.value} from ${fromAlias(memberFillIn, "shown_face_line")} where ${faceLine.userId} = ${memberId}
    and ${faceLine.field} = ${FILL_IN_FIELDS.face} and ${faceLine.hiddenAt} is null and ${faceLine.value} <> '')`;
}

export function avatarUpdatedAtColumn(memberId: AnyPgColumn | SQL) {
  return sql<Date | null>`(select ${ownAvatar.updatedAt} from ${fromAlias(memberAvatar, "shown_face_avatar")} where ${ownAvatar.userId} = ${memberId})`.mapWith(
    (value: string | Date | null) => (value === null ? null : new Date(value)),
  );
}

// A table under its alias inside a raw subquery: drizzle writes only the alias's name for an aliased table.
function fromAlias(table: AnyPgTable, name: string) {
  return sql`${table} ${sql.identifier(name)}`;
}

// Matches a company name whatever its case or outer spaces.
function sameCompany(first: SQL | AnyPgColumn, second: SQL | AnyPgColumn) {
  return sql`lower(trim(${first})) = lower(trim(${second}))`;
}

function shownLogoQuery(memberId: AnyPgColumn | SQL) {
  return sql`select ${logoLine.value} from ${fromAlias(memberFillIn, "shown_logo_line")}
    join ${fromAlias(memberFillIn, "shown_logo_company")} on ${companyLine.userId} = ${logoLine.userId} and ${companyLine.field} = ${FILL_IN_FIELDS.company}
      and ${companyLine.hiddenAt} is null and ${companyLine.value} <> ''
    left join ${fromAlias(memberProfile, "shown_logo_profile")} on ${ownProfile.userId} = ${logoLine.userId}
    where ${logoLine.userId} = ${memberId} and ${logoLine.field} = ${FILL_IN_FIELDS.companyLogo}
      and ${logoLine.hiddenAt} is null and ${logoLine.value} <> ''
      and (nullif(trim(${ownProfile.company}), '') is null or ${sameCompany(ownProfile.company, companyLine.value)})`;
}

export function companyLogoColumn(memberId: AnyPgColumn | SQL) {
  return sql<string | null>`(${shownLogoQuery(memberId)})`;
}

// A company's logo for the job board: the logo of a member whose company on show is this company, the member who
// shared the board first.
export function logoOfCompanyColumn(company: AnyPgColumn | SQL, preferredMemberId: AnyPgColumn | SQL, now = new Date()) {
  const isActive = sql`exists (select 1 from ${fromAlias(user, "shown_logo_owner")} where ${logoOwner.id} = ${logoLine.userId} and ${isActiveMember(now, logoOwner)})`;
  return sql<string | null>`(${shownLogoQuery(sql`${logoLine.userId}`)} and ${sameCompany(companyLine.value, company)} and ${isActive}
    order by (${logoLine.userId} = ${preferredMemberId}) desc, ${logoLine.userId} limit 1)`;
}

// The uploaded photo's address; the version makes a new photo bypass the browser's cache.
export function toAvatarUrl(memberId: string, updatedAt: Date | null) {
  if (!updatedAt) return null;
  return `${API_ROUTES.members}/${encodeURIComponent(memberId)}/avatar?v=${updatedAt.getTime()}`;
}

export function toShownFaceUrl(memberId: string, avatarUpdatedAt: Date | null, filledFace: string | null) {
  return toAvatarUrl(memberId, avatarUpdatedAt) ?? filledFace ?? null;
}

// The two columns a read adds to draw a member's face; pass the result to toShownFaceUrl.
export function shownFaceColumns(memberId: AnyPgColumn | SQL) {
  return { avatarUpdatedAt: avatarUpdatedAtColumn(memberId), filledFace: filledFaceColumn(memberId) };
}

const companyOwnProfile = alias(memberProfile, "shown_company_profile");
const companyFilledLine = alias(memberFillIn, "shown_company_line");

// The company on show: the member's own words, else the filled-in company line.
export function shownCompanyColumn(memberId: AnyPgColumn | SQL) {
  return sql<string | null>`coalesce(
    (select nullif(${companyOwnProfile.company}, '') from ${fromAlias(memberProfile, "shown_company_profile")} where ${companyOwnProfile.userId} = ${memberId}),
    (select nullif(${companyFilledLine.value}, '') from ${fromAlias(memberFillIn, "shown_company_line")} where ${companyFilledLine.userId} = ${memberId}
      and ${companyFilledLine.field} = ${FILL_IN_FIELDS.company} and ${companyFilledLine.hiddenAt} is null))`;
}
