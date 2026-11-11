import type { Metadata } from "next";

import { IntrosList } from "@/modules/intros/components/intros-list";
import { introsManifest } from "@/modules/intros/manifest";
import { readIntroBoard } from "@/modules/intros/reads";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";
import { readAskAllowance } from "@/shell/ask-helpers";

export const metadata: Metadata = { title: "Your intros" };

export default modulePage(introsManifest, async function IntrosPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [board, allowance] = await Promise.all([readIntroBoard(database, member.id), readAskAllowance(database, member.id)]);
  return <IntrosList board={board} allowance={allowance} />;
});
