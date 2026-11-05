import { describe, expect, it } from "vitest";

import { detectImageContentType } from "@/platform/image-rules";
import { parseReturnPath, toSignInPath } from "@/platform/http/return-path";
import { parseDirectoryFilters, toDirectoryQueryString } from "./rules-directory-url";
import { parseExternalUrl, readExternalHost } from "./rules-external-url";
import { parseTagsText, toProfileBody } from "./rules-profile-form";

describe("external URLs", () => {
  it("keeps https and http", () => {
    expect(parseExternalUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(parseExternalUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("refuses a script scheme in any case", () => {
    expect(parseExternalUrl("JaVaScRiPt:alert(1)")).toBeNull();
  });

  it("refuses a hidden newline", () => {
    expect(parseExternalUrl("java\nscript:alert(1)")).toBeNull();
  });

  it("refuses a bare word, which is no address", () => {
    expect(parseExternalUrl("localhost")).toBeNull();
  });

  it("shows a short host", () => {
    expect(readExternalHost("https://www.example.com/about")).toBe("example.com");
  });
});

describe("the card form", () => {
  it("splits tags on commas and ignores blanks", () => {
    expect(parseTagsText(" Fintech, ,Series A,")).toEqual(["Fintech", "Series A"]);
  });

  it("sends tags as a list and everything else as text", () => {
    const formData = new FormData();
    formData.set("company", "Tidewell");
    formData.set("tags", "Climate, Seed");

    expect(toProfileBody(formData)).toEqual({ company: "Tidewell", tags: ["Climate", "Seed"] });
  });

  it("leaves tags out when the form has no tags field, so onboarding can't wipe them", () => {
    expect(toProfileBody(new FormData())).toEqual({});
  });
});

describe("the directory URL", () => {
  it("round-trips the filters", () => {
    const filters = { search: "ada lovelace", tag: "fintech", page: 3 };
    const queryString = toDirectoryQueryString(filters);

    expect(parseDirectoryFilters(Object.fromEntries(new URLSearchParams(queryString)))).toEqual(filters);
  });

  it("stays clean with no filters", () => {
    expect(toDirectoryQueryString({ search: "", tag: "", page: 1 })).toBe("");
  });

  it("falls back to page one for a nonsense page", () => {
    expect(parseDirectoryFilters({ page: "-4" }).page).toBe(1);
    expect(parseDirectoryFilters({ page: "abc" }).page).toBe(1);
  });

  it("strips a NUL byte from the URL", () => {
    expect(parseDirectoryFilters({ q: "no\0or" }).search).toBe("noor");
  });

  it("drops an overlong search rather than erroring", () => {
    expect(parseDirectoryFilters({ q: "x".repeat(500) }).search).toBe("");
  });
});

describe("returning after sign-in", () => {
  it("accepts the email confirmation page", () => {
    expect(parseReturnPath("/confirm-email?token=abc_DEF-123")).toBe("/confirm-email?token=abc_DEF-123");
  });

  it.each(["https://evil.test/confirm-email?token=a", "//evil.test", "/admin", "/confirm-email?token=a#@evil.test", undefined])(
    "refuses %s",
    (value) => {
      expect(parseReturnPath(value)).toBeNull();
    },
  );

  it("encodes the path so the token survives", () => {
    expect(toSignInPath("/confirm-email?token=abc")).toBe("/sign-in?next=%2Fconfirm-email%3Ftoken%3Dabc");
  });
});

describe("image rules", () => {
  it("detects by content, not by name", () => {
    expect(detectImageContentType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(detectImageContentType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});
