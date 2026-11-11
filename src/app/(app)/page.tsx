import { permanentRedirect } from "next/navigation";

import { ROUTES } from "@/platform/http/routes";

type HomeProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Today moved to Founderhall's address, /today. The old home address keeps working.
export default async function HomeRedirect({ searchParams }: HomeProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, one);
  }
  const query = params.toString();
  permanentRedirect(query ? `${ROUTES.today}?${query}` : ROUTES.today);
}
