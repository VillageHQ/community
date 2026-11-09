import { z } from "zod";

import { partnerReportPreviewSchema, partnerReportSentSchema } from "@/modules/admin/contract-partner-report";
import { API_ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";
import { readResponseFailure } from "@/platform/http/read-response-message";

const FILE_NAME_PATTERN = /filename="([^"]+)"/;
const DOWNLOAD_FAILED = "We couldn't make the CSV. Try again.";

export function previewPartnerReportRequest(note: string) {
  return postRequest(API_ROUTES.partnerReportPreview, { note }, partnerReportPreviewSchema);
}

export function sendPartnerReportRequest(body: { recipients: string; note: string }) {
  return postRequest(API_ROUTES.partnerReportSend, body, partnerReportSentSchema);
}

export function markPartnerReportSharedRequest() {
  return postRequest(API_ROUTES.partnerReportShared, {}, z.object({ isShared: z.boolean() }));
}

export async function downloadPartnerReportCsv() {
  const response = await fetch(API_ROUTES.partnerReportCsv, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
  if (!response) throw new Error(DOWNLOAD_FAILED);
  if (!response.ok) throw new Error((await readResponseFailure(response, DOWNLOAD_FAILED)).message);
  const fileName = response.headers.get("content-disposition")?.match(FILE_NAME_PATTERN)?.[1] ?? "partner-report.csv";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
