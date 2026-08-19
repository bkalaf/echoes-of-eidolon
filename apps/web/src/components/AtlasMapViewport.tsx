import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

export const siteClassificationPresentation = {
  HAMLET: { color: "#8FA7BA", relativeMarkerSize: 1 },
  VILLAGE: { color: "#51D29A", relativeMarkerSize: 1.15 },
  TOWN: { color: "#6FD3FF", relativeMarkerSize: 1.3 },
  CITY: { color: "#EFB83A", relativeMarkerSize: 1.5 },
  METROPOLIS: { color: "#D6A7FF", relativeMarkerSize: 1.8 },
} as const;

export interface AtlasMapPoint {
  classification?: keyof typeof siteClassificationPresentation | string;
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  occupied?: boolean;
}

export interface AtlasPointCluster {
  key: string;
  points: AtlasMapPoint[];
}

export function atlasMapPosition({ latitude, longitude }: Pick<AtlasMapPoint, "latitude" | "longitude">) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Atlas marker latitude must be within -90..90.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Atlas marker longitude must be within -180..180.");
  return { leftPercent: ((longitude + 180) / 360) * 100, topPercent: ((90 - latitude) / 180) * 100 };
}

export function clusterAtlasPoints(points: readonly AtlasMapPoint[], zoom: number): AtlasPointCluster[] {
  const cell = 5 / Math.max(1, zoom);
  const groups = new Map<string, AtlasMapPoint[]>();
  for (const point of points) {
    const position = atlasMapPosition(point);
    const key = `${Math.floor(position.leftPercent / cell)}:${Math.floor(position.topPercent / cell)}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([key, grouped]) => ({ key, points: grouped }));
}

function markerStyle(point: AtlasMapPoint, selected: boolean, spiderIndex?: number, spiderCount?: number): CSSProperties {
  const position = atlasMapPosition(point);
  const presentation = point.classification && point.classification in siteClassificationPresentation
    ? siteClassificationPresentation[point.classification as keyof typeof siteClassificationPresentation]
    : undefined;
  const angle = spiderIndex === undefined ? 0 : (spiderIndex / Math.max(spiderCount ?? 1, 1)) * Math.PI * 2;
  const radius = spiderIndex === undefined ? 0 : 34;
  const size = 18 * (presentation?.relativeMarkerSize ?? 1);
  return {
    "--atlas-marker-color": presentation?.color ?? (point.occupied ? "#FFFFFF" : "#6FD3FF"),
    "--atlas-marker-size": `${size}px`,
    left: position.leftPercent + "%",
    top: position.topPercent + "%",
    transform: `translate(calc(-50% + ${Math.cos(angle) * radius}px), calc(-50% + ${Math.sin(angle) * radius}px))`,
    zIndex: selected ? 50 : spiderIndex === undefined ? 2 : 20,
  } as CSSProperties;
}

export function AtlasMapViewport({ imageAlt, imageSrc, onSelect, points, selectedId }: {
  imageAlt: string;
  imageSrc: string;
  onSelect: (id: string) => void;
  points: readonly AtlasMapPoint[];
  selectedId?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spiderfyKey, setSpiderfyKey] = useState<string>();
  const clusters = clusterAtlasPoints(points, zoom);
  const constrainPan = (next: { x: number; y: number }, nextZoom = zoom) => {
    const viewport = viewportRef.current;
    const width = viewport?.clientWidth || 1000;
    const height = viewport?.clientHeight || 500;
    const maximumX = width * (nextZoom - 1) / 2;
    const maximumY = height * (nextZoom - 1) / 2;
    return { x: Math.max(-maximumX, Math.min(maximumX, next.x)), y: Math.max(-maximumY, Math.min(maximumY, next.y)) };
  };
  const applyZoom = (next: number) => {
    const normalized = Math.max(1, Math.min(6, next));
    setZoom(normalized);
    setPan((current) => constrainPan(current, normalized));
    if (normalized < 6) setSpiderfyKey(undefined);
  };
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSpiderfyKey(undefined); };
  const centerCluster = (cluster: AtlasPointCluster) => {
    if (zoom < 6) {
      const viewport = viewportRef.current;
      const average = cluster.points.reduce((sum, point) => { const position = atlasMapPosition(point); return { left: sum.left + position.leftPercent, top: sum.top + position.topPercent }; }, { left: 0, top: 0 });
      const nextZoom = Math.min(6, zoom + 1);
      const left = average.left / cluster.points.length;
      const top = average.top / cluster.points.length;
      setZoom(nextZoom);
      setPan(constrainPan({ x: ((50 - left) / 100) * (viewport?.clientWidth || 1000) * nextZoom, y: ((50 - top) / 100) * (viewport?.clientHeight || 500) * nextZoom }, nextZoom));
      if (nextZoom === 6) setSpiderfyKey(cluster.key);
    } else setSpiderfyKey(cluster.key);
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom === 1 || (event.target as HTMLElement).closest("button")) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const delta = { x: event.clientX - drag.current.x, y: event.clientY - drag.current.y };
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setPan((current) => constrainPan({ x: current.x + delta.x, y: current.y + delta.y }));
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = undefined;
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => { event.preventDefault(); applyZoom(zoom + (event.deltaY < 0 ? 1 : -1)); };

  useEffect(() => {
    if (!selectedId || zoom === 1) return;
    const selected = points.find((point) => point.id === selectedId);
    if (!selected) return;
    const viewport = viewportRef.current;
    const position = atlasMapPosition(selected);
    const width = viewport?.clientWidth || 1000;
    const height = viewport?.clientHeight || 500;
    const maximumX = width * (zoom - 1) / 2;
    const maximumY = height * (zoom - 1) / 2;
    const next = {
      x: Math.max(-maximumX, Math.min(maximumX, ((50 - position.leftPercent) / 100) * width * zoom)),
      y: Math.max(-maximumY, Math.min(maximumY, ((50 - position.topPercent) / 100) * height * zoom)),
    };
    setPan((current) => current.x === next.x && current.y === next.y ? current : next);
  }, [points, selectedId, zoom]);

  return <div className="atlas-map-shell">
    <div aria-label="Map zoom controls" className="atlas-map-controls">
      <button aria-label="Zoom out" disabled={zoom === 1} onClick={() => applyZoom(zoom - 1)} type="button">−</button>
      <output aria-label="Map zoom">{zoom}x</output>
      <button aria-label="Zoom in" disabled={zoom === 6} onClick={() => applyZoom(zoom + 1)} type="button">+</button>
      <button aria-label="Reset map" onClick={reset} type="button">Reset</button>
    </div>
    <div className="atlas-map-viewport" data-testid="atlas-map-viewport" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel} ref={viewportRef}>
      <div className="atlas-map-stage" data-testid="atlas-map-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <img alt={imageAlt} className="atlas-map-image" draggable={false} src={imageSrc} />
        <div aria-label="Atlas markers" className="atlas-map-markers">
          {clusters.flatMap((cluster) => {
            if (cluster.points.length === 1 || spiderfyKey === cluster.key) return cluster.points.map((point, index) => <button aria-label={`${point.label}${point.classification ? ` · ${point.classification}` : ""}${point.occupied ? " · founded Settlement" : ""}`} className={`map-data-pin ${point.occupied ? "occupied " : ""}${point.id === selectedId ? "selected" : ""}`} data-latitude={point.latitude} data-longitude={point.longitude} key={point.id} onClick={() => { onSelect(point.id); setSpiderfyKey(undefined); }} style={markerStyle(point, point.id === selectedId, cluster.points.length > 1 ? index : undefined, cluster.points.length)} title={`${point.label}${point.classification ? ` · ${point.classification}` : ""}`} type="button" />);
            const representative = cluster.points[0]!;
            return [<button aria-label={`Cluster containing ${cluster.points.length} Sites`} className="map-data-cluster" key={`cluster:${cluster.key}`} onClick={() => centerCluster(cluster)} style={markerStyle(representative, cluster.points.some((point) => point.id === selectedId))} type="button">{cluster.points.length}</button>];
          })}
        </div>
      </div>
    </div>
  </div>;
}
