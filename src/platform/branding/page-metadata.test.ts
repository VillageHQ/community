import { describe, expect, it } from "vitest";

import { metadata as adminMetadata } from "@/app/(app)/admin/page";
import { metadata as networkMetadata } from "@/app/(app)/search/page";
import { metadata as notFoundMetadata } from "@/app/not-found";
import { metadata as setupMetadata } from "@/app/setup/page";
import { metadata as signInMetadata } from "@/app/sign-in/page";
import { metadata as signUpMetadata } from "@/app/sign-up/page";

import { PAGE_TITLES, toRootMetadata } from "./page-metadata";

const BRANDING = { name: "Northwind", descriptor: "Founder community", logo: null };

describe("page titles", () => {
  it("give every page its own title, so the route announcer speaks on navigation", () => {
    const titles = [
      { title: PAGE_TITLES.feed },
      { title: PAGE_TITLES.home },
      networkMetadata,
      adminMetadata,
      setupMetadata,
      signInMetadata,
      signUpMetadata,
      notFoundMetadata,
    ].map(({ title }) => title);

    expect(new Set(titles).size).toBe(titles.length);
  });

  it("end with the community's name", () => {
    expect(toRootMetadata(BRANDING).title).toEqual({ default: "Northwind", template: "%s · Northwind" });
  });

  it("use the descriptor as the description", () => {
    expect(toRootMetadata(BRANDING).description).toBe("Founder community");
  });
});
