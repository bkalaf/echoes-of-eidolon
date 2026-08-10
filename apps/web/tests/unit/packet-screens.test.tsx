import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pageManifest } from "../../src/lib/page-manifest";
import { PacketScreen } from "../../src/screens/PacketScreen";

function entry(screenId: string) {
  return pageManifest.find((item) => item.screenId === screenId)!;
}

describe("packet screens", () => {
  it.each([
    ["PUB016", "Game & Server Status"],
    ["AUTH01", "Sign In"],
    ["ACC008", "Subscription - Active"],
    ["STORE10", "Order Confirmed"],
  ])("renders the %s reviewed task", (screenId, heading) => {
    render(<PacketScreen screen={entry(screenId)} />);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });
});
