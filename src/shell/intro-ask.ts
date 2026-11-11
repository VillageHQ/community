import "server-only";

import { and, eq } from "drizzle-orm";

import { user } from "@/platform/database/auth-schema";
import type { Database } from "@/platform/database/client";
import { isActiveMember } from "@/platform/auth/member-status";
import type { RequestContext } from "@/platform/http/request-context";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { memberProfile } from "@/modules/members/schema";
import { companyLogoColumn, shownCompanyColumn, shownFaceColumns, toShownFaceUrl } from "@/modules/members/reads-pictures";
import { readAcceptsIntroAsks } from "@/modules/members/service-privacy";
import { isBlockedBy } from "@/modules/members/service-blocks";
import { networkManifest } from "@/modules/network/manifest";
import { readMemberReach } from "@/modules/network/reads-member-reach";
import { readAskableConnectors } from "@/modules/network/service";

import type { AskerProfile } from "./intro-ask-note";

// What the intro ask pages read: the asker's profile for the drafted note, the member asked, and the path behind a
// one-step ask from search.

export type IntroConnectorCard = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  avatarUrl: string | null;
  companyLogoUrl: string | null;
  // False when they paused intro asks, a block stands between the two, or the admins' "chosen introducers" rule
  // leaves them out.
  canBeAsked: boolean;
};

export async function readAskerProfile(database: Database, memberId: string): Promise<AskerProfile> {
  const [row] = await database
    .select({ name: user.name, title: memberProfile.title, company: shownCompanyColumn(user.id), bio: memberProfile.bio, needs: memberProfile.needs })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .where(eq(user.id, memberId));
  return row ?? { name: "", title: null, company: null, bio: null, needs: null };
}

export async function readIntroConnectorCard(database: Database, connectorId: string, viewerId: string): Promise<IntroConnectorCard | null> {
  if (connectorId === viewerId) return null;
  const [row] = await database
    .select({
      id: user.id,
      name: user.name,
      title: memberProfile.title,
      company: shownCompanyColumn(user.id),
      companyLogoUrl: companyLogoColumn(user.id),
      ...shownFaceColumns(user.id),
    })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .where(and(eq(user.id, connectorId), isActiveMember()));
  if (!row) return null;
  const isNetworkOn = await isModuleEnabled(database, networkManifest);
  const [acceptsAsks, isBlocked, reach] = await Promise.all([
    readAcceptsIntroAsks(database, row.id),
    Promise.all([isBlockedBy(database, viewerId, row.id), isBlockedBy(database, row.id, viewerId)]).then(([one, other]) => one || other),
    isNetworkOn ? readMemberReach(database, row.id) : null,
  ]);
  const { avatarUpdatedAt, filledFace, ...card } = row;
  return { ...card, avatarUrl: toShownFaceUrl(row.id, avatarUpdatedAt, filledFace), canBeAsked: acceptsAsks && !isBlocked && (reach?.isIntroducer ?? true) };
}

export type OneStepAsk = {
  connectorSlug: string;
  targetName: string;
  // "CTO, Halcyon Health"
  targetAbout: string | null;
};

// The path behind "Ask Marcus for an intro": read from the asker's own cached paths, as the create does. Null when the
// path is gone (older than a day, or Marcus no longer shares).
export async function readOneStepAsk(context: RequestContext, targetSlug: string, connectorId: string): Promise<OneStepAsk | null> {
  const askable = await readAskableConnectors(context, targetSlug);
  const connector = askable?.connectors.find(({ member }) => member?.id === connectorId);
  if (!askable || !connector?.linkedinSlug || !askable.targetName) return null;
  return { connectorSlug: connector.linkedinSlug, targetName: askable.targetName, targetAbout: askable.targetHeadline };
}
