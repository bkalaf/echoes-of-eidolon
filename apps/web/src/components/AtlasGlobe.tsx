import { useRef, useState } from "react";

import { managedAssetUrl } from "../content/managed-assets";
import { projectGlobePoint, wrapLongitude } from "../domain/atlas-projection";
import type { CanonicalPointOfInterest } from "../server/atlas";

export function AtlasGlobe({
  onSelect,
  points,
  selectedId,
  unavailableMessage,
}: {
  onSelect: (poiId: string) => void;
  points: CanonicalPointOfInterest[];
  selectedId?: string;
  unavailableMessage?: string;
}) {
  const [centerLongitude, setCenterLongitude] = useState(0);
  const [centerLatitude, setCenterLatitude] = useState(0);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ latitude: number; longitude: number; pointerId: number; x: number; y: number } | undefined>(undefined);

  const reset = () => {
    setCenterLongitude(0);
    setCenterLatitude(0);
    setZoom(1);
  };

  return <div className="atlas-globe-wrap"><div
    aria-label="Interactive Eidolon globe. Use arrow keys to rotate, plus and minus to zoom, and Home to reset."
    className="atlas-globe"
    onKeyDown={(event) => {
      if (event.key === "ArrowLeft") setCenterLongitude((value) => wrapLongitude(value - 10));
      else if (event.key === "ArrowRight") setCenterLongitude((value) => wrapLongitude(value + 10));
      else if (event.key === "ArrowUp") setCenterLatitude((value) => Math.min(75, value + 10));
      else if (event.key === "ArrowDown") setCenterLatitude((value) => Math.max(-75, value - 10));
      else if (event.key === "+" || event.key === "=") setZoom((value) => Math.min(1.5, value + 0.1));
      else if (event.key === "-") setZoom((value) => Math.max(0.75, value - 0.1));
      else if (event.key === "Home") reset();
      else return;
      event.preventDefault();
    }}
    onPointerDown={(event) => {
      drag.current = { latitude: centerLatitude, longitude: centerLongitude, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (!drag.current || drag.current.pointerId !== event.pointerId) return;
      setCenterLongitude(wrapLongitude(drag.current.longitude - (event.clientX - drag.current.x) * 0.35));
      setCenterLatitude(Math.max(-75, Math.min(75, drag.current.latitude + (event.clientY - drag.current.y) * 0.25)));
    }}
    onPointerUp={(event) => {
      if (drag.current?.pointerId === event.pointerId) drag.current = undefined;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onWheel={(event) => {
      event.preventDefault();
      setZoom((value) => Math.max(0.75, Math.min(1.5, value + (event.deltaY < 0 ? 0.1 : -0.1))));
    }}
    role="application"
    tabIndex={0}
  >
    <img src={managedAssetUrl("atlas.nimbus.globe-albedo")} alt="" draggable={false} style={{ transform: `translateX(${-centerLongitude / 8}%) scale(${zoom})` }} />
    {points.map((point) => {
      const projected = projectGlobePoint({ centerLatitude, centerLongitude, latitude: point.latitude, longitude: point.longitude, zoom });
      return projected.visible && <button
        aria-label={`Select ${point.displayName ?? point.workingLabel}`}
        className={`map-data-pin ${point.poiId === selectedId ? "selected" : ""}`}
        key={point.poiId}
        onClick={() => onSelect(point.poiId)}
        style={{ left: `${projected.xPercent}%`, top: `${projected.yPercent}%` }}
      />;
    })}
  </div>{unavailableMessage && <p className="notice notice--warn" role="status">{unavailableMessage}</p>}<div className="action-row"><button className="button" onClick={reset}>Reset globe</button><span className="muted">Center {centerLatitude.toFixed(0)}°, {centerLongitude.toFixed(0)}° · Zoom {zoom.toFixed(1)}×</span></div></div>;
}
