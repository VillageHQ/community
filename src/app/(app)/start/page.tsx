import { redirect } from "next/navigation";

import { getDatabase } from "@/database/client";
import { readSetupProgress } from "@/lib/admin-setup";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";
import { isAdminMember } from "@/lib/village/member-network";

export default async function LandingPage() {
  const member = await requireMember();
  if (!isAdminMember(member)) redirect(ROUTES.home);

  const { isComplete } = await readSetupProgress(getDatabase(), process.env);
  redirect(isComplete ? ROUTES.home : ROUTES.admin);
}
