import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AtlasGlobe, projectGlobeLocation, type AtlasGlobeAnnotation, type AtlasGlobeLocation } from "../../src/components/AtlasGlobe";

const locations: AtlasGlobeLocation[] = Array.from({ length: 24 }, (_, index) => ({
  color: index === 0 ? "#FFFFFF" : index === 1 ? "#000000" : index === 5 ? "#FF0000" : "#A52A2A",
  id: `SITE-${String(index + 1).padStart(4, "0")}`,
  label: `Founding City ${index + 1}`,
  latitude: index - 12,
  longitude: index * 10 - 115,
  regionId: `R${String(index < 9 ? index + 1 : index + 2).padStart(2, "0")}`,
  textColor: index === 1 ? "#FFFFFF" : undefined,
}));

const annotations: AtlasGlobeAnnotation[] = [
  { id: "continent-raukaam", kind: "continent", label: "Raukaam", latitude: 41.093565, longitude: -98.497755 },
  { id: "POI-091", kind: "geographic", label: "Northern Ocean", latitude: 73, longitude: 0 },
];

describe("AtlasGlobe", () => {
  it("renders exactly 24 labeled founding-city controls with Region-colored text", () => {
    render(<AtlasGlobe labelMode="visible" locations={locations} onSelect={() => undefined} regionTintUrl="/region-tint.png" />);

    const controls = document.querySelectorAll("[data-atlas-founding-city]");
    expect(controls).toHaveLength(24);
    expect(screen.getByText("Founding City 1")).toHaveStyle({ color: "#FFFFFF" });
    expect(screen.getByText("Founding City 2")).toHaveStyle({ color: "#FFFFFF" });
    expect(screen.getByText("Founding City 6")).toHaveStyle({ color: "#FF0000" });
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

  it("scales the complete globe surface for diameter zoom without changing the camera projection", () => {
    render(<AtlasGlobe labelMode="visible" locations={locations.slice(0, 2)} onSelect={() => undefined} zoomBehavior="diameter" />);

    const globe = screen.getByRole("application", { name: /Interactive Eidolon globe/ });
    const zoom = screen.getByRole("slider", { name: "Globe zoom" });
    expect(globe).toHaveAttribute("data-zoom-behavior", "diameter");
    expect(globe).toHaveStyle({ transform: "scale(1)" });

    fireEvent.change(zoom, { target: { value: "115" } });
    expect(globe).toHaveStyle({ transform: "scale(1.15)" });
    expect(screen.getByTestId("atlas-globe-status")).toHaveTextContent("Zoom 115%");
  });

  it("renders projected continent and geographic annotations as noninteractive labels with independent visibility", () => {
    const { rerender } = render(<AtlasGlobe annotations={annotations} continentLabelsVisible geographicLabelsVisible locations={locations.slice(0, 1)} onSelect={() => undefined} regionTintVisible />);

    expect(document.querySelectorAll("[data-atlas-continent-label]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-atlas-geographic-point]")).toHaveLength(1);
    const geographicPoint = document.querySelector("[data-atlas-geographic-point]");
    expect(geographicPoint?.querySelector("[data-atlas-geographic-anchor]")).toBeInTheDocument();
    expect(geographicPoint?.querySelector("[data-atlas-geographic-label]")).toHaveTextContent("Northern Ocean");
    expect(screen.queryByRole("button", { name: /Raukaam|Northern Ocean/ })).not.toBeInTheDocument();
    expect(screen.getByRole("application", { name: /Interactive Eidolon globe/ })).toHaveAttribute("data-region-colors", "visible");

    rerender(<AtlasGlobe annotations={annotations} continentLabelsVisible={false} geographicLabelsVisible={false} locations={locations.slice(0, 1)} onSelect={() => undefined} regionTintVisible={false} />);
    expect(screen.getByRole("application", { name: /Interactive Eidolon globe/ })).toHaveAttribute("data-region-colors", "hidden");
    expect(document.querySelector("[data-atlas-continent-label]")).toHaveAttribute("data-layer-visible", "false");
    expect(document.querySelector("[data-atlas-geographic-point]")).toHaveAttribute("data-layer-visible", "false");
  });
});
