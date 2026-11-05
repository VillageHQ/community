import { isValidElement, type ReactNode } from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { VillageSecretCard } from "@/modules/admin/components/village-secret-card";
import { networkManifest } from "@/modules/network/manifest";
import { saveModuleState } from "@/platform/modules/enablement";
import { VILLAGE_KEY_STATUSES } from "@/platform/village/contract";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "@/platform/settings/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import AdminSettingsPage from "./page";

const session = vi.hoisted(() => ({ cookie: "" }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: session.cookie }) }));

function findSecretCard(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(findSecretCard).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  return node.type === VillageSecretCard ? node : findSecretCard(node.props.children);
}

describe("the settings page", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    session.cookie = (await createSignedInMember(database, "admin")).cookie;
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("shows the key's status with Network off", async () => {
    await saveModuleState(database, networkManifest, false);
    await database.insert(instanceSettings).values([
      { key: INSTANCE_SETTING_KEYS.villagePublicKey, value: "pk_test" },
      { key: INSTANCE_SETTING_KEYS.villageSecretKey, value: "sk_test" },
    ]);

    const card = findSecretCard(await AdminSettingsPage({ searchParams: Promise.resolve({}) }));

    expect(isValidElement<{ status: string }>(card) && card.props.status).toBe(VILLAGE_KEY_STATUSES.plain);
  });
});
