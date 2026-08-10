import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AboutPage } from "../../src/screens/public/AboutPage";

describe("approved About content", () => {
  it("renders the owner-supplied promises, making statement, and address", () => {
    render(<AboutPage />);
    expect(screen.getByText("A subscription will never be required.")).toBeInTheDocument();
    expect(screen.getByText(/Authored narrative \+ deterministic systems/)).toBeInTheDocument();
    expect(screen.getByText(/5400 Kearny Mesa Rd, 1712/)).toBeInTheDocument();
    expect(screen.queryByText(/REVIEW WIREFRAME/)).not.toBeInTheDocument();
  });
});
