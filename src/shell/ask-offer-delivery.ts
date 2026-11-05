import "server-only";

import { composeOfferMessage } from "@/modules/asks/contract";
import type { OfferDelivery } from "@/modules/asks/service";
import { messagesManifest } from "@/modules/messages/manifest";
import { sendMessage, startConversation } from "@/modules/messages/service";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { logError } from "@/platform/observability/route-logging";

// The note is already saved on the ask, so a failure here costs the helper a DM and loses nothing.
export const sendOfferAsMessage: OfferDelivery = async (context, { id, askerId, askTitle, note }) => {
  if (!(await isModuleEnabled(context.database, messagesManifest))) return false;
  try {
    const { conversationId } = await startConversation(context, askerId);
    await sendMessage(context, { conversationId, clientKey: id, body: composeOfferMessage(askTitle, note) });
    return true;
  } catch (error) {
    logError("asks-offer-delivery", error);
    return false;
  }
};
