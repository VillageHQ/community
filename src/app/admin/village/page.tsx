import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageCard } from "@/components/page-card";
import { getDatabase } from "@/database/client";
import { resolveAppUrl } from "@/lib/app-url";
import { getAuth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  createNetworkContext,
  isAdminMember,
  readVillageGroupReadiness,
  readVillageLinks,
} from "@/lib/village/member-network";
import { readVillageGroup, readVillageKeys } from "@/lib/village/settings";

import { GroupForm } from "./group-form";
import { KeysForm } from "./keys-form";
import { VillageLinks } from "./village-links";

async function readAdminUserSafely(context: Parameters<typeof readVillageGroupReadiness>[0]) {
  try {
    return { villageUser: await readVillageGroupReadiness(context), isVillageReachable: true };
  } catch {
    return { villageUser: null, isVillageReachable: false };
  }
}

export default async function VillageSettingsPage() {
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect(ROUTES.signIn);
  if (!isAdminMember(session.user)) redirect(ROUTES.home);

  const database = getDatabase();
  const keys = await readVillageKeys(database);
  const group = await readVillageGroup(database);
  const domain = new URL(resolveAppUrl(process.env)).hostname;
  const context = createNetworkContext(database, process.env, session.user);
  const { villageUser, isVillageReachable } = await readAdminUserSafely(context);
  const villageLinks = await readVillageLinks(database);

  return (
    <PageCard title="Village settings">
      <Link className="text-sm underline" href={ROUTES.home}>
        Home
      </Link>
      <section aria-labelledby="domain-heading" className="grid gap-2 text-sm">
        <h2 id="domain-heading" className="font-medium">
          1. Register this domain
        </h2>
        <p>In Village, open Platform Settings and enter this exact domain:</p>
        <code className="rounded bg-muted px-2 py-1">{domain}</code>
      </section>
      <section aria-labelledby="keys-heading" className="grid gap-2 text-sm">
        <h2 id="keys-heading" className="font-medium">
          2. Paste your app keys
        </h2>
        {keys ? <p>Keys are saved. The secret key never leaves this server.</p> : null}
        <KeysForm savedPublicKey={keys?.publicKey ?? ""} hasSavedKeys={Boolean(keys)} />
      </section>
      <section aria-labelledby="group-heading" className="grid gap-2 text-sm">
        <h2 id="group-heading" className="font-medium">
          3. Create the community group
        </h2>
        <GroupForm
          hasKeys={Boolean(keys)}
          hasGroup={Boolean(group)}
          isVillageReachable={isVillageReachable}
          isSynced={Boolean(villageUser?.isSyncComplete)}
        />
      </section>
      <section aria-labelledby="links-heading" className="grid gap-2 text-sm">
        <h2 id="links-heading" className="font-medium">
          4. Manage Village links
        </h2>
        <VillageLinks links={villageLinks} />
      </section>
    </PageCard>
  );
}
