"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { JOB_BOARD_API_ROUTES, JOB_BOARD_LIMITS } from "../contract";
import { useJobAction } from "./use-job-action";

export function AddJobForm({ sourceId }: { sourceId: string }) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const add = useJobAction<{ sourceId: string; title: string; location: string; url: string }>(JOB_BOARD_API_ROUTES.addJob, {
    onDone: () => {
      setTitle("");
      setLocation("");
      setUrl("");
    },
  });
  const field = (name: string) => `job-${name}-${sourceId}`;
  return (
    <form
      className="grid gap-3 rounded-field bg-muted p-4"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate({ sourceId, title, location, url });
      }}
    >
      <p className="type-small font-bold">Add a job by hand</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={field("title")}>Title</Label>
          <Input id={field("title")} value={title} maxLength={JOB_BOARD_LIMITS.titleLength} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={field("location")}>Location (optional)</Label>
          <Input id={field("location")} value={location} maxLength={JOB_BOARD_LIMITS.locationLength} onChange={(event) => setLocation(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={field("url")}>Apply link</Label>
        <Input
          id={field("url")}
          value={url}
          maxLength={JOB_BOARD_LIMITS.linkLength}
          onChange={(event) => setUrl(event.target.value)}
          inputMode="url"
          placeholder="https://"
          required
        />
      </div>
      <FormError message={add.error?.message ?? null} />
      <div>
        <Button type="submit" size="sm" disabled={add.isPending} className="max-sm:w-full">
          Add the job
        </Button>
      </div>
    </form>
  );
}

export function RemoveJobButton({ sourceId, jobId, title }: { sourceId: string; jobId: string; title: string }) {
  const remove = useJobAction<{ sourceId: string; jobId: string }>(JOB_BOARD_API_ROUTES.removeJob);
  return (
    <Button variant="quiet" size="icon" disabled={remove.isPending} onClick={() => remove.mutate({ sourceId, jobId })} title={remove.error?.message}>
      <Trash2 aria-hidden="true" />
      <span className="sr-only">Remove {title}</span>
    </Button>
  );
}
