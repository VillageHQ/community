import { BulkInviteLimitError, MAXIMUM_CSV_BYTES } from "@/modules/members/contract-bulk-invites";
import { IMPORT_PARAMS, readImportBasis } from "@/modules/members/contract-import";
import { importMembers } from "@/modules/members/service-import";
import { membersRoutes } from "@/modules/members/routes";
import { RequestError } from "@/platform/http/request-error";

const UNPROCESSABLE_STATUS = 422;
const ON = "1";

// Set up › Import members (CSV). The body is the file itself; the switch and the fill-in basis ride in the address.
export const POST = membersRoutes.adminBinary(
  "invite-import",
  { maximumBytes: MAXIMUM_CSV_BYTES, tooLargeMessage: "This file is over 8 MB. Split it and upload each part." },
  async (context, bytes, request) => {
    const params = new URL(request.url).searchParams;
    const basis = readImportBasis(params.get(IMPORT_PARAMS.basis), params.get(IMPORT_PARAMS.termsDate));
    if ("error" in basis) return Response.json({ field: IMPORT_PARAMS.basis, message: basis.error }, { status: UNPROCESSABLE_STATUS });
    const csv = new TextDecoder().decode(bytes);
    if (!csv.trim()) return Response.json({ field: "file", message: "Choose your CSV file." }, { status: UNPROCESSABLE_STATUS });
    try {
      return Response.json(await importMembers(context, csv, { sendEmail: params.get(IMPORT_PARAMS.invite) === ON, basis }));
    } catch (error) {
      if (error instanceof BulkInviteLimitError) return Response.json({ field: "file", message: error.message }, { status: UNPROCESSABLE_STATUS });
      if (error instanceof RequestError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
      throw error;
    }
  },
);
