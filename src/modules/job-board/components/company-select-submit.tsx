"use client";

import type { ComponentProps } from "react";

import { Select } from "@/components/ui/select";

// Founderhall's `data-autosubmit` select: choosing a company sends the filter form.
export function CompanySelectSubmit(props: ComponentProps<typeof Select>) {
  return <Select {...props} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
