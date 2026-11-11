import { describe, expect, it } from "vitest";

import { placeTextFooter } from "@/platform/email/unsubscribe";

import { renderMessageEmail } from "./email";

const LINK = "https://portal.example.com/inbox/3";

describe("the new-message email, in Founderhall's words", () => {
  it("names the sender, links the Inbox and signs off as the community", () => {
    const email = renderMessageEmail({ senderName: "Sam Lee", communityName: "Northwind Founders", link: LINK, accentColor: "#24525A", canReply: true });

    expect(email.subject).toBe("Sam Lee sent you a message");
    expect(email.text).toBe(
      `Sam Lee sent you a message.\n\nReply to this email to answer, or open it in the portal: ${LINK}\n\nSent by Northwind Founders via its member portal.`,
    );
  });

  it("puts the stop line above the sign-off", () => {
    const { text } = renderMessageEmail({ senderName: "Sam Lee", communityName: "Northwind Founders", link: LINK, accentColor: "#24525A", canReply: true });

    expect(placeTextFooter(text, "\n\nStop emails about new messages: https://x.example/stop")).toBe(
      `Sam Lee sent you a message.\n\nReply to this email to answer, or open it in the portal: ${LINK}\n\nStop emails about new messages: https://x.example/stop\n\nSent by Northwind Founders via its member portal.`,
    );
    expect(placeTextFooter("Hello.", "\n\nFooter")).toBe("Hello.\n\nFooter");
  });
});
