import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ErrorBoundary from "./error";

const SENSITIVE_ERROR = new Error("connect ECONNREFUSED postgres://admin:hunter2@db.internal:5432");

function renderErrorPage() {
  const props = { error: SENSITIVE_ERROR, reset: () => undefined };
  return renderToStaticMarkup(createElement(ErrorBoundary, props));
}

describe("the error page", () => {
  it("says in plain language that the database may be unreachable", () => {
    expect(renderErrorPage()).toContain("may not be able to reach its database");
  });

  it("points to the README", () => {
    expect(renderErrorPage()).toContain("#troubleshooting");
  });

  it("offers a retry button", () => {
    expect(renderErrorPage()).toContain("Try again");
  });

  it("never shows the raw error or connection details", () => {
    const page = renderErrorPage();

    expect(page).not.toContain("ECONNREFUSED");
    expect(page).not.toContain("hunter2");
    expect(page).not.toContain("db.internal");
  });
});
