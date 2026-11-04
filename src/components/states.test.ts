import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AppLoading from "@/app/(app)/loading";

import { EmptyState } from "./empty-state";
import { ErrorState, RetryButton } from "./error-state";
import { LoadingState } from "./loading-state";

describe("the empty state", () => {
  it("shows its title and description", () => {
    const markup = renderToStaticMarkup(createElement(EmptyState, { title: "Nothing yet", description: "Check back." }));

    expect(markup).toContain("Nothing yet");
    expect(markup).toContain("Check back.");
  });

  it("hides its art from screen readers", () => {
    const markup = renderToStaticMarkup(createElement(EmptyState, { title: "Nothing yet", description: "Check back." }));

    expect(markup).toContain('aria-hidden="true"');
  });
});

describe("the loading state", () => {
  it("announces itself as a status", () => {
    const markup = renderToStaticMarkup(createElement(LoadingState, { title: "Searching" }));

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Searching");
  });
});

describe("the page loading state", () => {
  it("tells people what's happening in words, not only with shapes", () => {
    const markup = renderToStaticMarkup(createElement(AppLoading));

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Just a moment");
  });
});

describe("the error state", () => {
  it("announces itself as an alert", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorState, { title: "Broken", description: "It failed." }, createElement(RetryButton)),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Try again");
  });
});
