import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VILLAGE_KEY_STATUSES } from "@/platform/village/contract";

import { KeysForm } from "./keys-form";

function renderForm(keyStatus?: (typeof VILLAGE_KEY_STATUSES)[keyof typeof VILLAGE_KEY_STATUSES]) {
  return renderToStaticMarkup(createElement(KeysForm, { savedPublicKey: "pk_test", hasSavedKeys: false, keyStatus }));
}

describe("the keys form", () => {
  describe("with the setup token gone", () => {
    it("says to restore it, and what pasting without it does", () => {
      const form = renderForm(VILLAGE_KEY_STATUSES.tokenMissing);

      expect(form).toContain("Put SETUP_TOKEN back");
      expect(form).toContain("stored unencrypted");
      expect(form).not.toContain("changed");
    });
  });

  describe("with a different setup token", () => {
    it("offers the old token or pasting again", () => {
      const form = renderForm(VILLAGE_KEY_STATUSES.tokenDifferent);

      expect(form).toContain("Your setup token changed");
      expect(form).toContain("Put the old token back");
      expect(form).toContain("paste your keys again");
    });
  });

  it("doesn't blame the token when the key couldn't be derived", () => {
    const form = renderForm(VILLAGE_KEY_STATUSES.unavailable);

    expect(form).toContain("Reload this page");
    expect(form).not.toContain("token");
  });

  it("keeps the public key for pasting again", () => {
    expect(renderForm(VILLAGE_KEY_STATUSES.tokenDifferent)).toContain("pk_test");
  });

  it.each([undefined, VILLAGE_KEY_STATUSES.sealed, VILLAGE_KEY_STATUSES.plain])("stays quiet with status %s", (status) => {
    expect(renderForm(status)).not.toContain("role=\"status\"");
  });
});
