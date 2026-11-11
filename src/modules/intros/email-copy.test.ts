import { describe, expect, it } from "vitest";

import {
  CONNECTOR_UPDATES,
  renderAskEnded,
  renderConnectorAsk,
  renderConnectorUpdate,
  renderIntroduction,
  renderOutcomeQuestion,
  renderTargetAsk,
  renderThanksToConnector,
} from "./email-copy";
import FOUNDERHALL from "./email-copy.fixtures.json";

// Every intro email, word for word against Founderhall's (subject and body, captured from Founderhall's own demo with
// its made-up people). Only the links and names are inputs.
const COMMUNITY = "Northwind Founders";
const SAM_NOTE = "I’m Sam, Co-founder & CEO at Tallyhealth. Prior-authorisation automation for outpatient clinics. An intro to procurement at a US hospital group. Could you introduce me to Rosa at Halcyon Health?";
const PORTAL = "https://portal.northwind.example";

type Expected = { subject: string; text: string };

function expectSame(rendered: { subject: string; text: string; html: string }, expected: Expected) {
  expect(rendered.subject).toBe(expected.subject);
  expect(rendered.text).toBe(expected.text);
  expect(rendered.html).toContain("white-space:pre-wrap");
}

describe("intro emails match Founderhall's word for word", () => {
  it("asks the connector", () => {
    const link = "http://127.0.0.1:9600/i/5-c-27b34109c5f171684a32";
    const rendered = renderConnectorAsk({
      community: COMMUNITY,
      asker: "Sam Lee",
      askerAbout: "Co-founder & CEO, Tallyhealth",
      connector: "Marcus Webb",
      target: "Rosa Lindqvist",
      targetAbout: "CTO, Halcyon Health",
      note: SAM_NOTE,
      links: { yes: `${link}?a=yes`, notNow: `${link}?a=not_now`, dontKnow: `${link}?a=dont_know` },
      canReply: true,
    });
    expectSame(rendered, FOUNDERHALL["email-intro-ask-to-connector"]);
  });

  it("asks the person, and reminds them once", () => {
    const link = "http://127.0.0.1:9600/i/5-t-e39ffc9978087e8924da";
    expectSame(
      renderTargetAsk({
        community: COMMUNITY,
        connector: "Marcus Webb",
        asker: "Sam Lee",
        askerAbout: "Co-founder & CEO, Tallyhealth",
        target: "Rosa Lindqvist",
        note: SAM_NOTE,
        links: { yes: `${link}?a=yes`, no: `${link}?a=no` },
        optOutLink: "http://127.0.0.1:9600/intro/optout/5-0b976a3ccef3c2ac5c6f",
      }),
      FOUNDERHALL["email-intro-ask-to-target"],
    );
    expectSame(
      renderTargetAsk({
        community: COMMUNITY,
        connector: "Marcus Webb",
        asker: "Sam Lee",
        askerAbout: null,
        target: "Rosa Lindqvist",
        note: "I’m Sam, Co-founder & CEO at Tallyhealth…",
        links: { yes: `${PORTAL}/i/…?a=yes`, no: `${PORTAL}/i/…?a=no` },
        optOutLink: `${PORTAL}/intro/optout/…`,
        isReminder: true,
      }),
      FOUNDERHALL["email-intro-ask-to-target-reminder"],
    );
  });

  it("introduces them, the asker's copy showing both addresses", () => {
    const rendered = renderIntroduction(
      {
        community: COMMUNITY,
        asker: "Sam Lee",
        askerAbout: "Co-founder & CEO, Tallyhealth",
        target: "Rosa Lindqvist",
        targetAbout: "CTO, Halcyon Health",
        connector: "Marcus Webb",
        askerEmail: "sam.lee@example.com",
        targetEmail: "tom.becker@greenline.example",
        note: SAM_NOTE,
      },
      "asker",
    );
    expectSame(rendered, FOUNDERHALL["email-introduction"]);
  });

  it("tells the asker when an ask ends", () => {
    const ended = { community: COMMUNITY, asker: "Sam Lee", target: "Rosa Lindqvist", allowanceLeft: "4 of 5 asks left this week", findLink: `${PORTAL}/search` };
    expectSame(renderAskEnded({ ...ended, who: "Marcus", isExpired: false }), FOUNDERHALL["email-intro-declined-to-asker"]);
    expectSame(renderAskEnded({ ...ended, who: "Marcus", isExpired: true }), FOUNDERHALL["email-intro-expired-to-asker"]);
  });

  it("tells the connector when an ask closes", () => {
    expectSame(
      renderConnectorUpdate({ community: COMMUNITY, connector: "Ada Okafor", asker: "Sam Lee", target: "Nina Patel", kind: CONNECTOR_UPDATES.withdrawn }),
      FOUNDERHALL["email-intro-closed-to-connector"],
    );
    const closed = { community: COMMUNITY, connector: "Marcus Webb", asker: "Sam Lee", target: "Rosa Lindqvist" };
    expectSame(renderConnectorUpdate({ ...closed, kind: CONNECTOR_UPDATES.declined }), FOUNDERHALL["email-intro-closed-to-connector-declined"]);
    expectSame(renderConnectorUpdate({ ...closed, kind: CONNECTOR_UPDATES.expired }), FOUNDERHALL["email-intro-closed-to-connector-expired"]);
  });

  it("asks if the intro helped, reminds once, and thanks the connector", () => {
    const links = { helpful: `${PORTAL}/i/…?a=helpful`, notReally: `${PORTAL}/i/…?a=not_really`, tooEarly: `${PORTAL}/i/…?a=too_early` };
    const question = { community: COMMUNITY, asker: "Sam Lee", target: "Rosa Lindqvist", connector: "Marcus Webb", links };
    expectSame(renderOutcomeQuestion({ ...question, daysAgo: 14 }), FOUNDERHALL["email-intro-outcome-question"]);
    expectSame(renderOutcomeQuestion({ ...question, daysAgo: 21, isReminder: true }), FOUNDERHALL["email-intro-outcome-question-reminder"]);
    expectSame(
      renderThanksToConnector({ community: COMMUNITY, connector: "Marcus Webb", asker: "Sam Lee", target: "Rosa Lindqvist" }),
      FOUNDERHALL["email-intro-thanks-to-connector"],
    );
  });
});
