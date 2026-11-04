import { describe, expect, it } from "vitest";

import { readLinkedinSlug, toLinkedinUrl } from "./linkedin-slug";

describe("readLinkedinSlug", () => {
  describe("with a profile URL", () => {
    it.each([
      ["https://www.linkedin.com/in/Jane-Doe/", "jane-doe"],
      ["http://linkedin.com/in/jane-doe", "jane-doe"],
      ["linkedin.com/in/jane-doe?trk=share", "jane-doe"],
      ["  https://br.linkedin.com/in/JANE-doe#about  ", "jane-doe"],
      ["https://www.linkedin.com/in/jos%C3%A9", "josé"],
    ])("reads %s as %s", (linkedinUrl, slug) => {
      expect(readLinkedinSlug(linkedinUrl)).toBe(slug);
    });
  });

  describe("with anything else", () => {
    it.each([
      [null],
      [""],
      ["jane-doe"],
      ["https://www.linkedin.com/company/village"],
      ["https://linkedin.com.evil.test/in/jane-doe"],
      ["https://evil-linkedin.com/in/jane-doe"],
      ["javascript:alert(1)//linkedin.com/in/jane-doe"],
    ])("returns null for %s", (linkedinUrl) => {
      expect(readLinkedinSlug(linkedinUrl)).toBeNull();
    });
  });
});

describe("toLinkedinUrl", () => {
  it("round-trips a slug that needs encoding", () => {
    expect(readLinkedinSlug(toLinkedinUrl("josé"))).toBe("josé");
  });

  it("keeps a hostile slug inside the profile path", () => {
    expect(new URL(toLinkedinUrl("../../evil?x=1")).pathname).toBe("/in/..%2F..%2Fevil%3Fx%3D1");
  });
});
