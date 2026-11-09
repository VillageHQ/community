import { reportCreditBodySchema } from "@/modules/members/contract-report-credit";
import { setReportCredit } from "@/modules/members/service-report-credit";
import { membersRoutes } from "@/modules/members/routes";

export const POST = membersRoutes.member("profile-report-credit", reportCreditBodySchema, async ({ database, member }, { isOn }) =>
  Response.json(await setReportCredit(database, member.id, isOn)),
);
