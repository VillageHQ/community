import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

import { NetworkFlowLoader } from "./network-flow-loader";

export default async function NetworkPage() {
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect(ROUTES.signIn);

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 p-4">
      <header className="grid gap-1">
        <Link className="text-sm underline" href={ROUTES.home}>
          Home
        </Link>
        <h1 className="text-2xl font-semibold">Your network</h1>
      </header>
      <NetworkFlowLoader />
    </main>
  );
}
