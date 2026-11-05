import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KeysForm } from "./keys-form";

const REENTRY_NOTICE = "Your setup token changed";

describe("the keys form", () => {
  it("says why it's asking again after the setup token changes", () => {
    const form = renderToStaticMarkup(createElement(KeysForm, { savedPublicKey: "pk_test", hasSavedKeys: false, needsReentry: true }));

    expect(form).toContain(REENTRY_NOTICE);
    expect(form).toContain("pk_test");
  });

  it("stays quiet otherwise", () => {
    const form = renderToStaticMarkup(createElement(KeysForm, { savedPublicKey: "pk_test", hasSavedKeys: true }));

    expect(form).not.toContain(REENTRY_NOTICE);
  });
});
