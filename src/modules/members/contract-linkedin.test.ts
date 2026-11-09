import { linkedinUrl } from "@villagehq/sdk";
import { describe, expect, it } from "vitest";

import { readLinkedinSlug } from "./contract-linkedin";

describe("readLinkedinSlug", () => {
  describe("with a profile URL", () => {
    it.each([
      ["https://www.linkedin.com/in/Jane-Doe/", "jane-doe"],
      ["http://linkedin.com/in/jane-doe", "jane-doe"],
      ["linkedin.com/in/jane-doe?trk=share", "jane-doe"],
      ["  https://br.linkedin.com/in/JANE-doe#about  ", "jane-doe"],
      ["https://www.linkedin.com/in/jos%C3%A9", "josé"],
    ])("reads %s as %s", (profileUrl, slug) => {
      expect(readLinkedinSlug(profileUrl)).toBe(slug);
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
      ["https://www.linkedin.com/in/jane%0Adoe"],
      ["https://www.linkedin.com/in/%20"],
    ])("returns null for %s", (profileUrl) => {
      expect(readLinkedinSlug(profileUrl)).toBeNull();
    });
  });
});

describe("linkedinUrl", () => {
  it("round-trips a slug that needs encoding", () => {
    expect(readLinkedinSlug(linkedinUrl("josé"))).toBe("josé");
  });

  it("keeps a hostile slug inside the profile path", () => {
    expect(new URL(linkedinUrl("../../evil?x=1")).pathname).toBe("/in/..%2F..%2Fevil%3Fx%3D1");
  });
});
