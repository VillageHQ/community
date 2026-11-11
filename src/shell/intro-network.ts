import "server-only";

import { INTRO_ERROR_CODES, type PathIntroBody } from "@/modules/intros/contract";
import type { AskedConnector, IntroNetwork } from "@/modules/intros/service";
import { networkManifest } from "@/modules/network/manifest";
import { canMemberIntroduce, readAskableConnectors } from "@/modules/network/service";
import type { Database } from "@/platform/database/client";
import type { RequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { isModuleEnabled } from "@/platform/modules/enablement";

const CONFLICT_STATUS = 409;

// A path ask: the person and the connector come from the member's own cached Village paths, never from the browser.
async function readPathAsk(context: RequestContext, { targetSlug, connectorSlug }: PathIntroBody): Promise<AskedConnector> {
  const askable = await readAskableConnectors(context, targetSlug);
  if (!askable) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.pathsStale,
      "Look up who can intro you to this person first. It only takes a moment.",
    );
  }
  const connector = askable.connectors.find(({ linkedinSlug, member }) => linkedinSlug === connectorSlug && member !== null);
  if (!connector?.member) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.notConnector,
      "This person can't take this intro request through the community. Look up who can intro you again.",
    );
  }
  if (!askable.targetName) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.targetUnknown,
      "Village didn't tell us who this person is, so we can't send this intro request. Try someone else.",
    );
  }
  return {
    introducerId: connector.member.id,
    introducerName: connector.name,
    introducerHeadline: connector.headline,
    introducerLinkedinSlug: connectorSlug,
    reason: connector.reason,
    targetName: askable.targetName,
    targetHeadline: askable.targetHeadline,
  };
}

const INTRO_NETWORK: IntroNetwork = { readPathAsk, canIntroduce: canMemberIntroduce };

// What intros gets of the Village network: paths and the "chosen introducers" rule while Network is on, else nothing.
export async function readIntroNetwork(database: Database) {
  return (await isModuleEnabled(database, networkManifest)) ? INTRO_NETWORK : null;
}
