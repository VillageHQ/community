import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "./error";

const SENSITIVE_ERROR = new Error("connect ECONNREFUSED postgres://admin:hunter2@db.internal:5432");

function renderErrorPage() {
  const props = { error: SENSITIVE_ERROR, retry: () => undefined };
  return renderToStaticMarkup(createElement(ErrorBoundary, props));
}

function findClickHandler(node: ReactNode): (() => void) | null {
  if (!isValidElement<{ onClick?: () => void; children?: ReactNode }>(node)) return null;
  if (node.props.onClick) return node.props.onClick;
  return Children.toArray(node.props.children).map(findClickHandler).find(Boolean) ?? null;
}

describe("the error page", () => {
  it("retries with Next's refetching retry, so it recovers once the database is back", () => {
    const retry = vi.fn();

    findClickHandler(ErrorBoundary({ retry }))?.();

    expect(retry).toHaveBeenCalledOnce();
  });

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
