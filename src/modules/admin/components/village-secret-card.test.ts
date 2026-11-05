import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VILLAGE_KEY_STATUSES } from "@/platform/village/contract";

import { VillageSecretCard } from "./village-secret-card";

function renderCard(status: (typeof VILLAGE_KEY_STATUSES)[keyof typeof VILLAGE_KEY_STATUSES], isNetworkOn = true) {
  return renderToStaticMarkup(createElement(VillageSecretCard, { status, isNetworkOn }));
}

describe("the Village secret card", () => {
  it("warns when sealing failed, and never says Sealed", () => {
    const card = renderCard(VILLAGE_KEY_STATUSES.sealFailed);

    expect(card).toContain("Not sealed");
    expect(card).toContain("still stored unencrypted");
    expect(card).not.toContain(">Sealed<");
  });

  it("tells a missing token from a different one", () => {
    expect(renderCard(VILLAGE_KEY_STATUSES.tokenMissing)).toContain("no setup token now");
    expect(renderCard(VILLAGE_KEY_STATUSES.tokenMissing)).toContain("stored unencrypted");
    expect(renderCard(VILLAGE_KEY_STATUSES.tokenDifferent)).toContain("Put the old token back");
  });

  it("points at Network when it's off, because the keys step is gone", () => {
    expect(renderCard(VILLAGE_KEY_STATUSES.tokenDifferent, false)).toContain("turn on Network");
  });

  it("doesn't tell a preview to check its database", () => {
    const card = renderCard(VILLAGE_KEY_STATUSES.preview);

    expect(card).toContain("preview");
    expect(card).not.toContain("check your database");
  });

  it("shows nothing with no keys saved", () => {
    expect(renderCard(VILLAGE_KEY_STATUSES.missing)).toBe("");
  });
});
