import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { claimFirstAdmin } from "@/lib/first-admin";
import { ROUTES } from "@/lib/routes";
import { clearDatabase, createTestDatabase } from "@/test/database";

import SignInPage from "./page";
import { SignInFields } from "./sign-in-form";

describe("a failed sign-in", () => {
  function renderFailure() {
    return renderToStaticMarkup(
      createElement(SignInFields, { state: { errorMessage: "Invalid email or password", email: "admin@example.test" } }),
    );
  }

  it("announces the error", () => {
    expect(renderFailure()).toMatch(/role="alert"[^>]*>.*Invalid email or password/s);
  });

  it("marks both fields invalid and ties them to the error", () => {
    const fields = renderFailure().match(/<input[^>]*>/g) ?? [];

    expect(fields).toHaveLength(2);
    for (const field of fields) {
      expect(field).toContain('aria-invalid="true"');
      expect(field).toContain('aria-describedby="sign-in-error"');
    }
  });

  it("keeps the typed email", () => {
    expect(renderFailure()).toContain('value="admin@example.test"');
  });

  it("marks nothing invalid before a failure", () => {
    const untouched = renderToStaticMarkup(createElement(SignInFields, { state: { errorMessage: null, email: "" } }));

    expect(untouched).not.toContain('aria-invalid="');
  });
});

describe("the sign-in page", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    await claimFirstAdmin(database, {
      name: "Admin",
      email: "admin@example.test",
      password: "a-long-test-password",
    });
  });

  it("doesn't link to the closed sign-up page", async () => {
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(html).not.toContain(ROUTES.signUp);
    expect(html).not.toContain("Need an account");
  });
});
