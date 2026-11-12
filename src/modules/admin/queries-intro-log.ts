import { readResponseFailure } from "@/platform/http/read-response-message";
import { postRequest } from "@/platform/http/post-request";
import { outcomeDaysSchema } from "@/modules/intros/contract-outcome-days";

import { INTRO_LOG_API } from "./contract-intro-log";

const FILE_NAME_PATTERN = /filename="([^"]+)"/;
const DOWNLOAD_FAILED = "We couldn't make the CSV. Try again.";

export function saveOutcomeDaysRequest(outcomeDays: number) {
  return postRequest(INTRO_LOG_API.outcomeDays, { outcomeDays }, outcomeDaysSchema);
}

export async function downloadIntroLogCsv(period: string) {
  const response = await fetch(INTRO_LOG_API.csv, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) }).catch(() => null);
  if (!response) throw new Error(DOWNLOAD_FAILED);
  if (!response.ok) throw new Error((await readResponseFailure(response, DOWNLOAD_FAILED)).message);
  const fileName = response.headers.get("content-disposition")?.match(FILE_NAME_PATTERN)?.[1] ?? "intros.csv";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
