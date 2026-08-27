import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AtlasGlobe, projectGlobeLocation, type AtlasGlobeLocation } from "../../src/components/AtlasGlobe";

const locations: AtlasGlobeLocation[] = Array.from({ length: 24 }, (_, index) => ({
  color: index === 0 ? "#00796B" : index === 5 ? "#0077A0" : index === 20 ? "#AD1457" : "#A67700",
  id: `SITE-${String(index + 1).padStart(4, "0")}`,
  label: `Founding City ${index + 1}`,
  latitude: index - 12,
  longitude: index * 10 - 115,
  regionId: `R${String(index < 9 ? index + 1 : index + 2).padStart(2, "0")}`,
}));

describe("AtlasGlobe", () => {
  it("renders exactly 24 labeled founding-city controls with Region-colored text", () => {
    render(<AtlasGlobe labelMode="visible" locations={locations} onSelect={() => undefined} regionTintUrl="/region-tint.png" />);

    const controls = document.querySelectorAll("[data-atlas-founding-city]");
    expect(controls).toHaveLength(24);
    expect(screen.getByText("Founding City 1")).toHaveStyle({ color: "#00796B" });
    expect(screen.getByText("Founding City 6")).toHaveStyle({ color: "#0077A0" });
    expect(screen.getByText("Founding City 21")).toHaveStyle({ color: "#AD1457" });
  });

  it("selects a city exactly once without beginning root pointer capture", () => {
    const onSelect = vi.fn();
    render(<AtlasGlobe labelMode="visible" locations={locations.slice(0, 2)} onSelect={onSelect} />);
    const globe = screen.getByRole("application", { name: /Interactive Eidolon globe/ });
    const setPointerCapture = vi.fn();
    Object.defineProperty(globe, "setPointerCapture", { configurable: true, value: setPointerCapture });
    const city = screen.getByRole("button", { name: "Select Founding City 1" });

    fireEvent.pointerDown(city, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.click(city);
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("SITE-0001");

    fireEvent.pointerDown(globe, { clientX: 50, clientY: 50, pointerId: 2 });
    expect(setPointerCapture).toHaveBeenCalledWith(2);
  });

  it("projects front-side locations and suppresses the back hemisphere", () => {
    expect(projectGlobeLocation({ latitude: 0, longitude: 0 }, { distance: 2.7, pitch: 0, yaw: 0 }, 1).visible).toBe(true);
    expect(projectGlobeLocation({ latitude: 0, longitude: 80 }, { distance: 2.7, pitch: 0, yaw: 0 }, 1).visible).toBe(false);
    expect(projectGlobeLocation({ latitude: 0, longitude: 180 }, { distance: 2.7, pitch: 0, yaw: 0 }, 1).visible).toBe(false);
  });
});
