"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postRequest } from "@/platform/http/post-request";
import { readResponseFailure } from "@/platform/http/read-response-message";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { DELETE_CONFIRMATION_WORD, deleteAccountResponseSchema } from "@/modules/members/contract-privacy";

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

export function ExportCard() {
  const download = useMutation({ mutationFn: downloadExport });
  return (
    <section aria-labelledby="export-title" className="grid gap-3 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <h2 id="export-title" className="type-h3">
        Take it with you
      </h2>
      <p className="type-small text-foreground-soft">
        Everything above about you, in one JSON file: your card, choices, posts, asks, answers, offers, the intros you are part of, and the messages you sent. It never
        holds another member&apos;s private notes or messages.
      </p>
      <div>
        <Button type="button" variant="outline" disabled={download.isPending} onClick={() => download.mutate()} className="max-sm:w-full">
          <Download aria-hidden="true" />
          {download.isPending ? "Making your file…" : "Export my data"}
        </Button>
      </div>
      <FormError message={download.error?.message ?? null} />
    </section>
  );
}

function deleteOwnAccount(confirmation: string) {
  return postRequest(API_ROUTES.profileDelete, { confirmation }, deleteAccountResponseSchema);
}

function goToSignIn() {
  window.location.assign(ROUTES.signInAfterDeletion);
}

export function DeleteAccountCard({ communityName, isAdmin }: { communityName: string; isAdmin: boolean }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  // When Village couldn't be reached the member reads what is left to do before leaving; otherwise they go straight on.
  const deletion = useMutation({ mutationFn: deleteOwnAccount, onSuccess: ({ isVillageIncomplete }) => (isVillageIncomplete ? undefined : goToSignIn()) });
  const isTypedRight = typed.trim().toLowerCase() === DELETE_CONFIRMATION_WORD;

  return (
    <section aria-labelledby="delete-title" className="grid gap-3 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <h2 id="delete-title" className="type-h3">
        Delete my account
      </h2>
      <p className="type-small text-foreground-soft">
        This deletes your account from {communityName} for good: your card, photo, posts, asks, answers and offers, and the words of every message you sent (the other
        member sees &quot;deleted&quot;). If you joined network search, Village is asked to remove you too. Intros you were part of stay only as anonymous counts. There is
        no undo. Export your data first if you want a copy.
      </p>
      {isAdmin ? <p className="type-small text-foreground-soft">You are an admin. If you are the only one, make another member an admin first.</p> : null}
      {deletion.data?.isVillageIncomplete ? (
        <div role="status" className="grid gap-3 rounded-field bg-muted p-3.5">
          <p>{deletion.data.message}</p>
          <div>
            <Button type="button" onClick={goToSignIn} className="max-sm:w-full">
              Done
            </Button>
          </div>
        </div>
      ) : isConfirming ? (
        <form
          className="grid gap-3 rounded-field bg-muted p-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (isTypedRight) deletion.mutate(typed);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="delete-confirmation">Type &quot;{DELETE_CONFIRMATION_WORD}&quot; to confirm</Label>
            <Input id="delete-confirmation" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus />
          </div>
          <FormError message={deletion.error?.message ?? null} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={!isTypedRight || deletion.isPending} className="max-sm:w-full">
              {deletion.isPending ? "Deleting…" : "Delete my account for good"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsConfirming(false)} className="max-sm:w-full">
              Keep my account
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={() => setIsConfirming(true)} className="max-sm:w-full">
            <Trash2 aria-hidden="true" />
            Delete my account
          </Button>
        </div>
      )}
    </section>
  );
}
