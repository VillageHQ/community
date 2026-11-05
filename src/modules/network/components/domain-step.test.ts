import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VILLAGE_PLATFORM_LINKS } from "@/platform/village/links";

import { DomainStep } from "./domain-step";

describe("the domain step", () => {
  const step = renderToStaticMarkup(createElement(DomainStep, { domain: "community.example.com", isDone: false }));

  it("shows the exact address to paste", () => {
    expect(step).toContain("community.example.com");
  });

  it("links to where someone without a Village account can create one", () => {
    expect(step).toContain(`href="${VILLAGE_PLATFORM_LINKS.home}"`);
    expect(step).toContain("New developer account");
  });

  it("links to the Village page that holds the domain field", () => {
    expect(step).toContain(`href="${VILLAGE_PLATFORM_LINKS.appSettings}"`);
    expect(step).toContain("Domain Name");
  });
});
