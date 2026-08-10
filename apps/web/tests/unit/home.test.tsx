import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "../../src/screens/public/HomePage";

describe("public home", () => {
  it("renders the approved hero and all nine carousel features", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /when the moons align/i })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(screen.getByText("A subscription will never be required.")).toBeVisible();
  });

  it("moves through all nine features with controlled carousel navigation", () => {
    Element.prototype.scrollIntoView = () => undefined;
    render(<HomePage />);
    expect(screen.getByText("Feature 1 of 9")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next feature" }));
    expect(screen.getByText("Feature 2 of 9")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Previous feature" }));
    expect(screen.getByText("Feature 1 of 9")).toBeVisible();
  });
});
