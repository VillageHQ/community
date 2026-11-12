import { BULK_INVITE_FORMATS, BulkInviteLimitError, MAXIMUM_CSV_BYTES, parseBulkInvites, readListCohort } from "@/modules/members/contract-bulk-invites";
import { createBulkInvites } from "@/modules/members/service-bulk-invites";
import { membersRoutes } from "@/modules/members/routes";
import { RequestError } from "@/platform/http/request-error";

const UNPROCESSABLE_STATUS = 422;
const FORMAT_PARAM = "format";
const COHORT_PARAM = "cohort";

// The body is the pasted text or the CSV file itself, so an 8 MB file needs no JSON wrapping. A pasted list's cohort
// (one for everyone on it) comes in the address.
export const POST = membersRoutes.adminBinary(
  "invite-bulk",
  { maximumBytes: MAXIMUM_CSV_BYTES, tooLargeMessage: "This file is over 8 MB. Split it and upload each part." },
  async (context, bytes, request) => {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get(FORMAT_PARAM) === BULK_INVITE_FORMATS.csv ? BULK_INVITE_FORMATS.csv : BULK_INVITE_FORMATS.list;
    try {
      const listCohort = format === BULK_INVITE_FORMATS.list ? readListCohort(searchParams.get(COHORT_PARAM)) : null;
      const parsed = parseBulkInvites(format, new TextDecoder().decode(bytes), listCohort);
      if (parsed.people.length === 0 && parsed.skipped.length === 0 && parsed.problems.length === 0) {
        return Response.json({ message: "There's nobody to invite yet. Add at least one email." }, { status: UNPROCESSABLE_STATUS });
      }
      return Response.json(await createBulkInvites(context, parsed));
    } catch (error) {
      if (error instanceof BulkInviteLimitError) return Response.json({ message: error.message }, { status: UNPROCESSABLE_STATUS });
      if (error instanceof RequestError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
      throw error;
    }
  },
);
