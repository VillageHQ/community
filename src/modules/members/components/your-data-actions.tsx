"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Note } from "@/components/ui/note";
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

function deleteOwnAccount(confirmation: string) {
  return postRequest(API_ROUTES.profileDelete, { confirmation }, deleteAccountResponseSchema);
}

function goToSignIn() {
  window.location.assign(ROUTES.signInAfterDeletion);
}

// Founderhall's "Delete my account" sheet holding the real delete (owner-approved): the member types the word, the
// account goes for good, and they land on sign-in. When Village could not be reached they read what is left first.
export function DeleteAccountSheet({ communityName, isAdmin }: { communityName: string; isAdmin: boolean }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const deletion = useMutation({ mutationFn: deleteOwnAccount, onSuccess: ({ isVillageIncomplete }) => (isVillageIncomplete ? undefined : goToSignIn()) });
  const isTypedRight = typed.trim().toLowerCase() === DELETE_CONFIRMATION_WORD;
  return (
    <section className="fh-sheet" id="delete" aria-labelledby="delete-title">
      <h2 id="delete-title" className="fh-h3 flex items-center gap-1.5">
        <X aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Delete my account
      </h2>
      <p className="fh-small mt-1.5">
        Deletes your profile, asks and messages from {communityName} for good. If you joined network search, Village is asked to remove you too. Intros you were part of
        stay only as anonymous counts. There is no undo: export your data first if you want a copy.
      </p>
      {isAdmin ? <p className="fh-small mt-1.5">You are an admin. If you are the only one, make another member an admin first.</p> : null}
      {deletion.data?.isVillageIncomplete ? (
        <div role="status" className="mt-2.5">
          <Note kind="needs">{deletion.data.message}</Note>
          <div className="fh-btn-row mt-2.5">
            <Button type="button" size="sm" onClick={goToSignIn}>
              Done
            </Button>
          </div>
        </div>
      ) : isConfirming ? (
        <form
          className="mt-2.5 grid gap-2.5"
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
          <div className="fh-btn-row">
            <Button type="submit" variant="destructive" size="sm" disabled={!isTypedRight || deletion.isPending}>
              {deletion.isPending ? "Deleting…" : "Delete my account for good"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsConfirming(false)}>
              Keep my account
            </Button>
          </div>
        </form>
      ) : (
        <div className="fh-btn-row mt-2.5">
          <Button type="button" variant="secondary" size="sm" onClick={() => setIsConfirming(true)}>
            Delete my account
          </Button>
        </div>
      )}
    </section>
  );
}
