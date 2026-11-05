"use client";

import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";

import { FormError } from "@/components/form-error";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES } from "@/platform/image-rules";
import { removeAvatar, uploadAvatar } from "@/lib/members/avatar-upload";

const AVATAR_INPUT_ID = "avatar-file";
const AVATAR_PREVIEW_SIZE_PX = 88;

function readSelectedFile(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0] ?? null;
  event.target.value = "";
  return file;
}

type AvatarFieldProps = { memberId: string; name: string; avatarUrl: string | null };

export function AvatarField({ memberId, name, avatarUrl }: AvatarFieldProps) {
  const router = useRouter();
  const uploadMutation = useMutation({ mutationFn: uploadAvatar, onSuccess: () => router.refresh() });
  const removeMutation = useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => {
      document.getElementById(AVATAR_INPUT_ID)?.focus();
      router.refresh();
    },
  });
  const isBusy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-4 rounded-field bg-muted p-3.5">
        <Avatar stableId={memberId} name={name} imageUrl={avatarUrl} sizePx={AVATAR_PREVIEW_SIZE_PX} />
        <div className="min-w-0 flex-[1_1_140px]">
          <div className="type-label">Your photo</div>
          <div className="type-small text-muted-foreground">PNG, JPEG or WebP. We&apos;ll crop it to a square.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={AVATAR_INPUT_ID}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring",
            )}
          >
            {uploadMutation.isPending ? "Saving…" : avatarUrl ? "Replace photo" : "Add a photo"}
            <input
              id={AVATAR_INPUT_ID}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              disabled={isBusy}
              className="sr-only"
              onChange={(event) => {
                const file = readSelectedFile(event);
                if (file) uploadMutation.mutate(file);
              }}
            />
          </label>
          {avatarUrl ? (
            <Button type="button" variant="quiet" size="sm" disabled={isBusy} onClick={() => removeMutation.mutate()}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <FormError message={uploadMutation.error?.message ?? removeMutation.error?.message ?? null} />
    </div>
  );
}
