import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { claimVillageBrowserSession, clearVillageBrowserSession } from "./browser-session";

function createStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  };
}

describe("the Village browser session", () => {
  const fakeDocument = { cookie: "" };

  beforeEach(() => {
    fakeDocument.cookie = "";
    vi.stubGlobal("document", fakeDocument);
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("when another member signs in on the same browser", () => {
    it("expires the first member's Village token so it can't link the second member", () => {
      claimVillageBrowserSession("member-a");
      sessionStorage.setItem("village.token", "member-a-token");

      claimVillageBrowserSession("member-b");

      expect(fakeDocument.cookie).toBe("village.token=; Max-Age=0; path=/");
      expect(sessionStorage.getItem("village.token")).toBeNull();
    });
  });

  describe("when the same member returns", () => {
    it("keeps the Village token", () => {
      claimVillageBrowserSession("member-a");
      fakeDocument.cookie = "untouched";

      claimVillageBrowserSession("member-a");

      expect(fakeDocument.cookie).toBe("untouched");
    });
  });

  describe("on sign-out", () => {
    it("expires the Village token", () => {
      sessionStorage.setItem("village.token", "member-a-token");

      clearVillageBrowserSession();

      expect(fakeDocument.cookie).toContain("Max-Age=0");
      expect(sessionStorage.getItem("village.token")).toBeNull();
    });
  });
});
