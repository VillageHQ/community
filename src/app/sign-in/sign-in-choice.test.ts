// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SignInChoice } from "./sign-in-form";

afterEach(cleanup);

describe("switching between the sign-in forms", () => {
  it("keeps the typed email when switching to the password form and back", () => {
    render(createElement(SignInChoice, { isLinkOn: true }));

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with a password instead" }));

    expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe("member@example.test");

    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link instead" }));

    expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe("member@example.test");
  });
});
