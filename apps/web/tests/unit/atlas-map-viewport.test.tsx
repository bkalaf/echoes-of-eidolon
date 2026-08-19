import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AtlasMapViewport, atlasMapPosition, clusterAtlasPoints, siteClassificationPresentation } from "../../src/components/AtlasMapViewport";

const points = [
  {
    id: "SITE-0401",
    label: "Select SITE-0401",
    latitude: 20.360822,
    longitude: -32.076454,
  },
  {
    id: "ORIGIN",
    label: "Select origin",
    latitude: 0,
    longitude: 0,
  },
];

describe("AtlasMapViewport", () => {
  it("projects the full EPSG:4326 world and the Ascendancy anchor without crop compensation", () => {
    expect(atlasMapPosition({ latitude: 90, longitude: -180 })).toEqual({ leftPercent: 0, topPercent: 0 });
    expect(atlasMapPosition({ latitude: -90, longitude: 180 })).toEqual({ leftPercent: 100, topPercent: 100 });
    expect(atlasMapPosition({ latitude: 0, longitude: 0 })).toEqual({ leftPercent: 50, topPercent: 50 });
    const ascendancy = atlasMapPosition(points[0]!);
    expect(ascendancy.leftPercent).toBeCloseTo(41.08987388888889, 12);
    expect(ascendancy.topPercent).toBeCloseTo(Number.parseFloat("38.688432222222224"), 12);
  });

  it("uses one responsive 2:1 stage for the contained image and projected marker layer", () => {
    render(
      <AtlasMapViewport
        imageAlt="Official Eidolon world map"
        imageSrc="/atlas.webp"
        onSelect={() => undefined}
        points={points}
        selectedId="SITE-0401"
      />,
    );
    const viewport = screen.getByTestId("atlas-map-viewport");
    const stage = screen.getByTestId("atlas-map-stage");
    const image = screen.getByRole("img", { name: "Official Eidolon world map" });
    const selected = screen.getByRole("button", { name: "Select SITE-0401" });
    expect(viewport).toContainElement(stage);
    expect(stage).toContainElement(image);
    expect(stage).toContainElement(selected);
    expect(stage).toHaveClass("atlas-map-stage");
    expect(image).toHaveClass("atlas-map-image");
    const ascendancy = atlasMapPosition(points[0]!);
    expect(selected).toHaveStyle({ left: ascendancy.leftPercent + "%", top: ascendancy.topPercent + "%" });
    expect(selected).toHaveClass("selected");
  });

  it("keeps marker selection keyboard-operable through the shared viewport", () => {
    const onSelect = vi.fn();
    render(
      <AtlasMapViewport
        imageAlt="Map"
        imageSrc="/atlas.webp"
        onSelect={onSelect}
        points={points}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select origin" }));
    expect(onSelect).toHaveBeenCalledWith("ORIGIN");
  });

  it("fails closed for coordinates outside the canonical world extent", () => {
    expect(() => atlasMapPosition({ latitude: 91, longitude: 0 })).toThrow(/latitude/i);
    expect(() => atlasMapPosition({ latitude: 0, longitude: -181 })).toThrow(/longitude/i);
  });

  it("clusters nearby candidates without mutating their canonical coordinates", () => {
    const coincident = [
      { id: "A", label: "A", latitude: 10, longitude: 20 },
      { id: "B", label: "B", latitude: 10, longitude: 20 },
    ];
    const before = structuredClone(coincident);
    expect(clusterAtlasPoints(coincident, 1)).toEqual([{ key: expect.any(String), points: coincident }]);
    expect(coincident).toEqual(before);
  });

  it("provides zoom/reset controls and exposes cluster membership accessibly", () => {
    render(<AtlasMapViewport imageAlt="Map" imageSrc="/atlas.webp" onSelect={() => undefined} points={[...points, { ...points[1]!, id: "ORIGIN-2", label: "Select second origin" }]} />);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cluster containing 2 Sites/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset map" }));
    expect(screen.getByText("1x")).toBeInTheDocument();
  });

  it("centers an externally selected Site without resetting the chosen zoom", () => {
    const { rerender } = render(<AtlasMapViewport imageAlt="Map" imageSrc="/atlas.webp" onSelect={() => undefined} points={points} />);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("atlas-map-stage")).toHaveStyle({ transform: "translate(0px, 0px) scale(2)" });
    rerender(<AtlasMapViewport imageAlt="Map" imageSrc="/atlas.webp" onSelect={() => undefined} points={points} selectedId="SITE-0401" />);
    expect(screen.getByTestId("atlas-map-stage")).not.toHaveStyle({ transform: "translate(0px, 0px) scale(2)" });
    expect(screen.getByText("2x")).toBeInTheDocument();
  });

  it("uses the exact non-color-only settlement classification presentation", () => {
    expect(siteClassificationPresentation).toEqual({
      HAMLET: { color: "#8FA7BA", relativeMarkerSize: 1 },
      VILLAGE: { color: "#51D29A", relativeMarkerSize: 1.15 },
      TOWN: { color: "#6FD3FF", relativeMarkerSize: 1.3 },
      CITY: { color: "#EFB83A", relativeMarkerSize: 1.5 },
      METROPOLIS: { color: "#D6A7FF", relativeMarkerSize: 1.8 },
    });
  });
});
