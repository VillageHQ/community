"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { useFlash } from "@/components/flash";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { postRequest } from "@/platform/http/post-request";
import { readResponseFailure } from "@/platform/http/read-response-message";
import { API_ROUTES } from "@/platform/http/routes";
import { formatDayMonth } from "@/platform/text/format-date";
import { toPossessive } from "@/modules/members/rules-words";

const DOWNLOAD_FAILED = "We couldn't make your file. Try again.";
const FILE_NAME_PATTERN = /filename="([^"]+)"/;

async function downloadExport() {
  const response = await fetch(API_ROUTES.profileExport, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
  if (!response) throw new Error(DOWNLOAD_FAILED);
  if (!response.ok) throw new Error((await readResponseFailure(response, DOWNLOAD_FAILED)).message);
  const fileName = response.headers.get("content-disposition")?.match(FILE_NAME_PATTERN)?.[1] ?? "my-data.json";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Founderhall's "Take it with you".
export function ExportSheet() {
  const download = useMutation({ mutationFn: downloadExport });
  return (
    <section className="fh-sheet" aria-labelledby="export-title">
      <h2 id="export-title" className="fh-h3 flex items-center gap-1.5">
        <Download aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Take it with you
      </h2>
      <p className="fh-small mt-1.5">Everything above about you, as one JSON file.</p>
      <div className="fh-btn-row mt-2.5">
        <Button type="button" variant="secondary" size="sm" disabled={download.isPending} onClick={() => download.mutate()}>
          <Download aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
          Export my data (JSON)
        </Button>
      </div>
      <FormError message={download.error?.message ?? null} />
    </section>
  );
}

const deletionRequestResponseSchema = z.object({ requestedAt: z.string() });

function askToDelete() {
  return postRequest(API_ROUTES.profileDeletionRequest, {}, deletionRequestResponseSchema);
}

// Founderhall's "Delete my account": a request to the admins, who delete the account and say so by email.
export function DeleteRequestSheet({ communityName, requestedAt }: { communityName: string; requestedAt: string | null }) {
  const router = useRouter();
  const flash = useFlash();
  const ask = useMutation({
    mutationFn: askToDelete,
    onSuccess: () => {
      flash("Sent. The admins have your request and tell you by email.");
      router.refresh();
    },
  });
  const askedAt = requestedAt ?? ask.data?.requestedAt ?? null;
  return (
    <section className="fh-sheet" id="delete" aria-labelledby="delete-title">
      <h2 id="delete-title" className="fh-h3 flex items-center gap-1.5">
        <X aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Delete my account
      </h2>
      {askedAt ? (
        <>
          <p className="mt-2">
            <Pill tone="open">Asked {formatDayMonth(askedAt)}</Pill>
          </p>
          <p className="fh-small mt-2">{toPossessive(communityName)} admins have your request. They delete your account and tell you by email.</p>
        </>
      ) : (
        <>
          <p className="fh-small mt-1.5">Sends a request to {toPossessive(communityName)} admins, who delete your profile, asks and messages and tell you by email.</p>
          <div className="fh-btn-row mt-2.5">
            <Button type="button" variant="secondary" size="sm" disabled={ask.isPending} onClick={() => ask.mutate()}>
              Ask to delete my account
            </Button>
          </div>
          <FormError message={ask.error?.message ?? null} />
        </>
      )}
    </section>
  );
}
