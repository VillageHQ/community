import { Check } from "lucide-react";

import { ButtonLink, TextLink } from "@/shell/console-home-parts";
import type { LaunchStep } from "@/shell/console-launch";
import { ROUTES } from "@/platform/http/routes";

// The console's Home before launch (Founderhall's launch checklist): four steps, in order, each with its status.
export function ConsoleLaunchView({ firstName, steps }: { firstName: string; steps: readonly LaunchStep[] }) {
  return (
    <>
      <div className="fh-pagehead">
        <h1 className="fh-h1 fh-launch-h">{firstName ? `Welcome, ${firstName}. Four steps to your first partner report.` : "Welcome. Four steps to your first partner report."}</h1>
        <p className="fh-lede">Four steps, in order. The first two take a few minutes; the console fills with real intros once founders join.</p>
      </div>
      <section className="fh-sheet fh-launch" aria-label="Launch checklist">
        <ol className="fh-launch-list">
          {steps.map((step) => (
            <li key={step.key} className={step.isDone ? "fh-done" : undefined} data-step={step.key}>
              {step.isDone ? (
                <span className="fh-lk fh-done">
                  <Check aria-hidden="true" />
                </span>
              ) : (
                <span className="fh-lk" />
              )}
              <div>
                <b>{step.title}</b>
                <p>
                  {step.text.map((part, index) =>
                    "href" in part ? (
                      <TextLink key={index} href={part.href}>
                        {part.text}
                      </TextLink>
                    ) : (
                      <span key={index}>{part.text}</span>
                    ),
                  )}
                </p>
              </div>
              <span className="fh-sr">{step.isDone ? "Done" : "Not done yet"}</span>
            </li>
          ))}
        </ol>
        <div className="fh-btn-row">
          <ButtonLink href={ROUTES.adminInvites} variant="primary">
            Invite founders
          </ButtonLink>
          <ButtonLink href={ROUTES.feed} variant="secondary">
            See it as a founder
          </ButtonLink>
        </div>
      </section>
      <p className="fh-small fh-muted fh-launch-foot">
        Everything else (mail domain, Village keys, Slack, perks) lives under{" "}
        <TextLink href={ROUTES.adminSetup}>
          <b>Set up</b>
        </TextLink>{" "}
        in the menu, with plain words.
      </p>
    </>
  );
}
