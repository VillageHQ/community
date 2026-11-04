import { Dialog } from "radix-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminSheetRow, PhoneUserMenu } from "./user-menu";

const ADMIN = { id: "admin-1", name: "Priya Raman", email: "priya@example.test", isAdmin: true };

function renderSheetRow(badgeCount: number | undefined) {
  return renderToStaticMarkup(createElement(Dialog.Root, null, createElement(AdminSheetRow, { badgeCount })));
}

describe("the phone account menu", () => {
  it("badges the Admin row with what needs attention", () => {
    expect(renderSheetRow(2)).toContain("2 need your attention");
  });

  it("shows no badge when nothing needs attention", () => {
    expect(renderSheetRow(0)).not.toContain("attention");
  });

  it("surfaces the count on the closed menu, so admins can see it without opening", () => {
    const markup = renderToStaticMarkup(createElement(PhoneUserMenu, { member: ADMIN, adminBadgeCount: 1 }));

    expect(markup).toContain("1 needs your attention");
  });
});
