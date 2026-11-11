// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SignInScreen } from "./sign-in-screen";

afterEach(cleanup);

const COMMUNITY = { name: "Northwind Founders", logo: null };

describe("the sign-in page's two ways in", () => {
  it("leads with the emailed link, in Founderhall's words", () => {
    render(createElement(SignInScreen, { community: COMMUNITY, isLinkOn: true, returnPath: null }));

    expect(screen.getByRole("heading", { name: "Sign in to Northwind Founders" })).toBeTruthy();
    expect(screen.getByText("We email you a link that signs you in. No password.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email me a sign-in link" })).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("keeps the typed email when switching to the password form and back", () => {
    render(createElement(SignInScreen, { community: COMMUNITY, isLinkOn: true, returnPath: null }));

    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "member@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with a password" }));

    expect(screen.getByLabelText<HTMLInputElement>("Your email").value).toBe("member@example.test");
    expect(screen.getByLabelText("Password")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link instead" }));

    expect(screen.getByLabelText<HTMLInputElement>("Your email").value).toBe("member@example.test");
  });

  it("leads with the password where no email can be sent", () => {
    render(createElement(SignInScreen, { community: COMMUNITY, isLinkOn: false, returnPath: null }));

    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Email me a sign-in link" })).toBeNull();
  });
});
