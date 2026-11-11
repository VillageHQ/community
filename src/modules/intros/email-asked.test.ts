import { describe, expect, it } from "vitest";

import { renderAskedEmail } from "./email";

const LINK = "https://northwind.example/intros/5";

// Founderhall's email to the connector (fh-reference copy/emails/email-intro-ask-to-connector.md), word for word.
const FOUNDERHALL_TEXT = `Hi Marcus,

Sam Lee (Co-founder & CEO, Tallyhealth) asked Northwind Founders for an intro to Rosa Lindqvist (CTO, Halcyon Health), through you.

Sam's note, written so you can forward it:

  I’m Sam, Co-founder & CEO at Tallyhealth. Prior-authorisation automation for outpatient clinics. An intro to procurement at a US hospital group. Could you introduce me to Rosa at Halcyon Health?

Would you introduce them?

Yes, introduce them: ${LINK}?a=yes
Not this time: ${LINK}?a=not_now
I don't know them well enough: ${LINK}?a=dont_know

Or reply to this email with YES or NO on the first line. With a yes, put Rosa's email on the next line: we email Rosa once, from Northwind Founders, and introduce you only if Rosa says yes too.

If you say no, Sam is told you can't make this one, never why. Nobody is introduced without saying yes.

Sent by Northwind Founders via its member portal.`;

const FACTS = {
  communityName: "Northwind Founders",
  requesterName: "Sam Lee",
  requesterAbout: "Co-founder & CEO, Tallyhealth",
  introducerName: "Marcus Webb",
  targetName: "Rosa Lindqvist",
  targetAbout: "CTO, Halcyon Health",
  note: "I’m Sam, Co-founder & CEO at Tallyhealth. Prior-authorisation automation for outpatient clinics. An intro to procurement at a US hospital group. Could you introduce me to Rosa at Halcyon Health?",
  link: LINK,
};

describe("the intro ask to the connector", () => {
  it("has Founderhall's subject and words", () => {
    const email = renderAskedEmail(FACTS, true);

    expect(email.subject).toBe("Marcus, would you introduce Sam Lee to Rosa Lindqvist?");
    expect(email.text).toBe(FOUNDERHALL_TEXT);
  });

  it("leaves out the reply line when replies are off", () => {
    expect(renderAskedEmail(FACTS, false).text).not.toContain("Or reply to this email");
  });

  it("keeps a note's own paragraphs, indented for forwarding", () => {
    const { text } = renderAskedEmail({ ...FACTS, note: "Who I am.\r\n\r\nWhy now." }, true);

    expect(text).toContain("  Who I am.\n\n  Why now.");
  });
});
