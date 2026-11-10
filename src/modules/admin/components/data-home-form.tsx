"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  MAXIMUM_DATA_CONTACT_NAME_LENGTH,
  MAXIMUM_DATA_LOCATION_LENGTH,
  type DataHomeBody,
} from "@/platform/settings/data-home-api";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

function saveDataHome(body: DataHomeBody) {
  return postRequest(API_ROUTES.dataHome, body, acknowledgedResponseSchema);
}

export function DataHomeForm({ saved }: { saved: DataHomeBody }) {
  const router = useRouter();
  const [location, setLocation] = useState(saved.location);
  const [contactName, setContactName] = useState(saved.contactName);
  const [contactEmail, setContactEmail] = useState(saved.contactEmail);
  const save = useMutation({ mutationFn: saveDataHome, onSuccess: () => router.refresh() });

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ location, contactName, contactEmail });
      }}
    >
      <FormField
        name="dataLocation"
        label="Where the data is kept"
        value={location}
        maxLength={MAXIMUM_DATA_LOCATION_LENGTH}
        onChange={(event) => setLocation(event.target.value)}
        placeholder="EU, Frankfurt, DigitalOcean"
        hint="The region and the host, in your own words. Members see exactly what you type."
      />
      <FormField
        name="dataContactName"
        label="Who handles data requests"
        value={contactName}
        maxLength={MAXIMUM_DATA_CONTACT_NAME_LENGTH}
        onChange={(event) => setContactName(event.target.value)}
        placeholder="Data protection lead"
        hint="A name or a role. Optional."
      />
      <FormField
        name="dataContactEmail"
        label="Their email"
        type="email"
        value={contactEmail}
        onChange={(event) => setContactEmail(event.target.value)}
        placeholder="privacy@example.com"
        hint="Members can write here to ask about, copy or delete their data."
      />
      <FormError message={save.error?.message ?? null} />
      {save.isSuccess ? <Alert variant="success">{save.data.message}</Alert> : null}
      <Button type="submit" disabled={save.isPending} className="max-sm:w-full sm:justify-self-start">
        {save.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
