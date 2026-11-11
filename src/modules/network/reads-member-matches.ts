import "server-only";

import { and, asc, eq, exists, inArray, ne, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberAvatar, memberProfile, memberTag } from "../members/schema.ts";
import { companyLogoColumn, toShownFaceUrl } from "../members/reads-pictures.ts";
import { FILL_IN_FIELDS } from "../members/contract-fill-in.ts";
import { shownFillInColumn } from "../members/service-fill-in.ts";
import { isListedInDirectory } from "../members/reads-directory.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import type { SearchMember } from "./contract.ts";

// Search shows members first, as "Member" rows: the members whose name, role, company, city, "can help with" or tags
// match the search (Founderhall searches its directory the same way), and the members Village found.
const MAXIMUM_MATCHED_MEMBERS = 4;

const filledTitle = shownFillInColumn(FILL_IN_FIELDS.title);
const filledCompany = shownFillInColumn(FILL_IN_FIELDS.company);
const filledLocation = shownFillInColumn(FILL_IN_FIELDS.location);
const filledFace = shownFillInColumn(FILL_IN_FIELDS.face);

const shownTitle = sql<string | null>`coalesce(nullif(${memberProfile.title}, ''), ${filledTitle.line.value})`;
const shownCompany = sql<string | null>`coalesce(nullif(${memberProfile.company}, ''), ${filledCompany.line.value})`;
const shownLocation = sql<string | null>`coalesce(nullif(${memberProfile.location}, ''), ${filledLocation.line.value})`;

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

// A word that starts with the search: "cto" finds "CTO" and "Co-founder & CTO", never "Director".
function matchesWords(database: Database, query: string) {
  const startsWord = `\\m${query.trim().replace(REGEX_SPECIALS, "\\$&")}`;
  const taggedMember = database
    .select({ userId: memberTag.userId })
    .from(memberTag)
    .where(and(eq(memberTag.userId, user.id), sql`${memberTag.tag} ~* ${startsWord}`));
  return or(
    sql`${user.name} ~* ${startsWord}`,
    sql`${shownTitle} ~* ${startsWord}`,
    sql`${shownCompany} ~* ${startsWord}`,
    sql`${memberProfile.canHelpWith} ~* ${startsWord}`,
    exists(taggedMember),
  );
}

export async function readSearchMembers(database: Database, query: string, viewerId: string, foundMemberIds: readonly string[]): Promise<SearchMember[]> {
  const byQuery = query.trim() ? matchesWords(database, query) : undefined;
  const byVillage = foundMemberIds.length > 0 ? inArray(user.id, [...foundMemberIds]) : undefined;
  const either = byQuery && byVillage ? or(byQuery, byVillage) : (byQuery ?? byVillage);
  if (!either) return [];
  const rows = await database
    .select({
      id: user.id,
      name: user.name,
      title: shownTitle,
      company: shownCompany,
      city: shownLocation,
      companyLogoUrl: companyLogoColumn(user.id),
      avatarUpdatedAt: memberAvatar.updatedAt,
      filledFaceUrl: filledFace.line.value,
    })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .leftJoin(filledTitle.line, filledTitle.joinCondition)
    .leftJoin(filledCompany.line, filledCompany.joinCondition)
    .leftJoin(filledLocation.line, filledLocation.joinCondition)
    .leftJoin(filledFace.line, filledFace.joinCondition)
    .where(and(isListedInDirectory(), ne(user.id, viewerId), either))
    .orderBy(asc(user.name), asc(user.id))
    .limit(MAXIMUM_MATCHED_MEMBERS + foundMemberIds.length);
  return rows.map(({ avatarUpdatedAt, filledFaceUrl, ...member }) => ({
    ...member,
    name: removeBidiControls(member.name),
    avatarUrl: toShownFaceUrl(member.id, avatarUpdatedAt, filledFaceUrl),
  }));
}
