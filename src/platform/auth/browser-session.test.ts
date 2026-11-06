import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearVillageBrowserSession } from "./browser-session";

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

  describe("on sign-out", () => {
    it("expires the token the old Village script left", () => {
      sessionStorage.setItem("village.token", "member-a-token");
      localStorage.setItem("community.village-member", "member-a");

      clearVillageBrowserSession();

      expect(fakeDocument.cookie).toContain("Max-Age=0");
      expect(sessionStorage.getItem("village.token")).toBeNull();
      expect(localStorage.getItem("community.village-member")).toBeNull();
    });
  });
});
