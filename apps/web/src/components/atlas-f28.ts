export type Vec3 = readonly [number, number, number];

export type PentagonTileId =
  | "PENT_HEAVENFALL"
  | "PENT_EARTH_FOCUS"
  | "PENT_WATER_FOCUS"
  | "PENT_TILTED_ISLE"
  | "PENT_HELL_PIT"
  | "PENT_MAELSTROM"
  | "PENT_COLOSSUS"
  | "PENT_EVEREST"
  | "PENT_DENSE_ATOLL"
  | "PENT_YGGDRASIL"
  | "PENT_VOLCANO_ISLE"
  | "PENT_ICE_FOCUS";

export interface F28Cell {
  hexId: string;
  center: Vec3;
  corners: Vec3[];
  latitude: number;
  longitude: number;
  pentagonTileId?: PentagonTileId;
}

export interface F28RenderGeometry {
  colors: Float32Array;
  emissions: Float32Array;
  normals: Float32Array;
  positions: Float32Array;
  vertexCount: number;
}

const FREQUENCY = 28;
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const BASE_RADIUS = Math.sqrt(1 + GOLDEN_RATIO * GOLDEN_RATIO);
const TILE_RADIUS = 1.004;
const CORE_RADIUS = 0.988;
const TILE_INSET = 0.92;

const BASE_VERTICES: Vec3[] = [
  [-GOLDEN_RATIO / BASE_RADIUS, 0, -1 / BASE_RADIUS],
  [-GOLDEN_RATIO / BASE_RADIUS, 0, 1 / BASE_RADIUS],
  [-1 / BASE_RADIUS, -GOLDEN_RATIO / BASE_RADIUS, 0],
  [-1 / BASE_RADIUS, GOLDEN_RATIO / BASE_RADIUS, 0],
  [0, -1 / BASE_RADIUS, -GOLDEN_RATIO / BASE_RADIUS],
  [0, -1 / BASE_RADIUS, GOLDEN_RATIO / BASE_RADIUS],
  [0, 1 / BASE_RADIUS, -GOLDEN_RATIO / BASE_RADIUS],
  [0, 1 / BASE_RADIUS, GOLDEN_RATIO / BASE_RADIUS],
  [1 / BASE_RADIUS, -GOLDEN_RATIO / BASE_RADIUS, 0],
  [1 / BASE_RADIUS, GOLDEN_RATIO / BASE_RADIUS, 0],
  [GOLDEN_RATIO / BASE_RADIUS, 0, -1 / BASE_RADIUS],
  [GOLDEN_RATIO / BASE_RADIUS, 0, 1 / BASE_RADIUS],
];

const BASE_FACES: ReadonlyArray<readonly [number, number, number]> = [
  [4, 2, 0], [6, 3, 0], [6, 4, 10], [6, 4, 0], [8, 5, 2],
  [8, 4, 10], [8, 4, 2], [1, 3, 0], [1, 2, 0], [1, 5, 2],
  [1, 7, 5], [1, 7, 3], [9, 7, 3], [9, 6, 3], [9, 6, 10],
  [11, 8, 10], [11, 7, 5], [11, 8, 5], [11, 9, 7], [11, 9, 10],
];

// Owner-locked rigid spherical rotation. This reproduces the Atlas v3 F28
// pentagon coordinates and therefore the latitude-descending / longitude-
// ascending HEX-#### identity assignment.
const LOCKED_ROTATION = [
  [0.291532118722, 0.9421008442, -0.165695573604],
  [0.887810920223, -0.330971957241, -0.319764496863],
  [-0.356090990741, -0.053884718416, -0.932896373363],
] as const;

export const PENTAGON_TILE_BY_HEX: Readonly<Record<string, PentagonTileId>> = {
  "HEX-0302": "PENT_HEAVENFALL",
  "HEX-0992": "PENT_EARTH_FOCUS",
  "HEX-1620": "PENT_WATER_FOCUS",
  "HEX-2174": "PENT_TILTED_ISLE",
  "HEX-3189": "PENT_HELL_PIT",
  "HEX-3537": "PENT_MAELSTROM",
  "HEX-4306": "PENT_COLOSSUS",
  "HEX-4654": "PENT_EVEREST",
  "HEX-5669": "PENT_DENSE_ATOLL",
  "HEX-6223": "PENT_YGGDRASIL",
  "HEX-6851": "PENT_VOLCANO_ISLE",
  "HEX-7541": "PENT_ICE_FOCUS",
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (value: Vec3, factor: number): Vec3 => [value[0] * factor, value[1] * factor, value[2] * factor];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (value: Vec3): Vec3 => {
  const magnitude = Math.hypot(value[0], value[1], value[2]);
  return [value[0] / magnitude, value[1] / magnitude, value[2] / magnitude];
};
const rotateLocked = (value: Vec3): Vec3 => [
  LOCKED_ROTATION[0][0] * value[0] + LOCKED_ROTATION[0][1] * value[1] + LOCKED_ROTATION[0][2] * value[2],
  LOCKED_ROTATION[1][0] * value[0] + LOCKED_ROTATION[1][1] * value[1] + LOCKED_ROTATION[1][2] * value[2],
  LOCKED_ROTATION[2][0] * value[0] + LOCKED_ROTATION[2][1] * value[1] + LOCKED_ROTATION[2][2] * value[2],
];
const vectorKey = (value: Vec3) => value.map((component) => component.toFixed(10)).join(",");
const hexId = (position: number) => `HEX-${String(position).padStart(4, "0")}`;

function makeTriangulatedGeodesic() {
  const vertices: Vec3[] = [];
  const triangles: Array<readonly [number, number, number]> = [];
  const vertexByKey = new Map<string, number>();
  const addVertex = (candidate: Vec3) => {
    const value = normalize(candidate);
    const key = vectorKey(value);
    const existing = vertexByKey.get(key);
    if (existing !== undefined) return existing;
    const index = vertices.length;
    vertices.push(value);
    vertexByKey.set(key, index);
    return index;
  };

  for (const [aIndex, bIndex, cIndex] of BASE_FACES) {
    const a = BASE_VERTICES[aIndex]!;
    const b = BASE_VERTICES[bIndex]!;
    const c = BASE_VERTICES[cIndex]!;
    const rows: number[][] = [];
    for (let row = 0; row <= FREQUENCY; row += 1) {
      const indices: number[] = [];
      for (let column = 0; column <= row; column += 1) {
        const aWeight = FREQUENCY - row;
        const bWeight = row - column;
        const cWeight = column;
        indices.push(addVertex([
          (a[0] * aWeight + b[0] * bWeight + c[0] * cWeight) / FREQUENCY,
          (a[1] * aWeight + b[1] * bWeight + c[1] * cWeight) / FREQUENCY,
          (a[2] * aWeight + b[2] * bWeight + c[2] * cWeight) / FREQUENCY,
        ]));
      }
      rows.push(indices);
    }
    for (let row = 0; row < FREQUENCY; row += 1) {
      for (let column = 0; column <= row; column += 1) {
        triangles.push([
          rows[row]![column]!,
          rows[row + 1]![column]!,
          rows[row + 1]![column + 1]!,
        ]);
        if (column < row) {
          triangles.push([
            rows[row]![column]!,
            rows[row]![column + 1]!,
            rows[row + 1]![column + 1]!,
          ]);
        }
      }
    }
  }

  return { triangles, vertices };
}

function orderCorners(center: Vec3, corners: Vec3[]) {
  const reference: Vec3 = Math.abs(center[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const tangent = normalize(cross(reference, center));
  const bitangent = cross(center, tangent);
  const ordered = [...corners].sort((left, right) => {
    const leftAngle = Math.atan2(dot(left, bitangent), dot(left, tangent));
    const rightAngle = Math.atan2(dot(right, bitangent), dot(right, tangent));
    return leftAngle - rightAngle;
  });
  if (ordered.length >= 2) {
    const outward = dot(cross(subtract(ordered[0]!, center), subtract(ordered[1]!, center)), center);
    if (outward < 0) ordered.reverse();
  }
  return ordered;
}

let cachedCells: F28Cell[] | undefined;
let cachedGeodesic: ReturnType<typeof makeTriangulatedGeodesic> | undefined;

export function createF28Cells(): F28Cell[] {
  if (cachedCells) return cachedCells;
  cachedGeodesic ??= makeTriangulatedGeodesic();
  const { triangles, vertices } = cachedGeodesic;
  const rotatedVertices = vertices.map((vertex) => normalize(rotateLocked(vertex)));
  const incidentTriangles = Array.from({ length: vertices.length }, () => [] as number[]);
  triangles.forEach((triangle, triangleIndex) => {
    incidentTriangles[triangle[0]]!.push(triangleIndex);
    incidentTriangles[triangle[1]]!.push(triangleIndex);
    incidentTriangles[triangle[2]]!.push(triangleIndex);
  });
  const triangleCenters = triangles.map(([aIndex, bIndex, cIndex]) => normalize(add(add(
    rotatedVertices[aIndex]!,
    rotatedVertices[bIndex]!,
  ), rotatedVertices[cIndex]!)));

  const metadata = rotatedVertices.map((center, sourceIndex) => ({
    center,
    latitude: Math.asin(Math.max(-1, Math.min(1, center[1]))) * 180 / Math.PI,
    longitude: Math.atan2(center[0], center[2]) * 180 / Math.PI,
    sourceIndex,
  }));
  metadata.sort((left, right) => right.latitude - left.latitude || left.longitude - right.longitude);
  cachedCells = metadata.map((item, sortedIndex) => {
    const id = hexId(sortedIndex + 1);
    const corners = orderCorners(item.center, incidentTriangles[item.sourceIndex]!.map((triangleIndex) => triangleCenters[triangleIndex]!));
    return {
      hexId: id,
      center: item.center,
      corners,
      latitude: item.latitude,
      longitude: item.longitude,
      ...(PENTAGON_TILE_BY_HEX[id] ? { pentagonTileId: PENTAGON_TILE_BY_HEX[id] } : {}),
    };
  });
  return cachedCells;
}

interface MutableGeometry {
  colors: number[];
  emissions: number[];
  normals: number[];
  positions: number[];
}

type Color = readonly [number, number, number];

function pushVertex(geometry: MutableGeometry, position: Vec3, normal: Vec3, color: Color, emission = 0) {
  geometry.positions.push(position[0], position[1], position[2]);
  geometry.normals.push(normal[0], normal[1], normal[2]);
  geometry.colors.push(color[0], color[1], color[2]);
  geometry.emissions.push(emission);
}

function pushTriangle(geometry: MutableGeometry, a: Vec3, b: Vec3, c: Vec3, color: Color, emission = 0, radialNormals = false) {
  const initialNormal = normalize(cross(subtract(b, a), subtract(c, a)));
  const outward = dot(initialNormal, add(add(a, b), c)) >= 0;
  const second = outward ? b : c;
  const third = outward ? c : b;
  const normal = outward ? initialNormal : scale(initialNormal, -1);
  pushVertex(geometry, a, radialNormals ? normalize(a) : normal, color, emission);
  pushVertex(geometry, second, radialNormals ? normalize(second) : normal, color, emission);
  pushVertex(geometry, third, radialNormals ? normalize(third) : normal, color, emission);
}

function insetCorner(center: Vec3, corner: Vec3, amount = TILE_INSET, radius = TILE_RADIUS) {
  return scale(normalize(add(scale(center, 1 - amount), scale(corner, amount))), radius);
}

function pushPolygonFan(geometry: MutableGeometry, center: Vec3, corners: Vec3[], color: Color, emission = 0, radius = TILE_RADIUS) {
  const raisedCenter = scale(center, radius);
  const insetCorners = corners.map((corner) => insetCorner(center, corner, TILE_INSET, radius));
  for (let index = 0; index < insetCorners.length; index += 1) {
    pushTriangle(
      geometry,
      raisedCenter,
      insetCorners[index]!,
      insetCorners[(index + 1) % insetCorners.length]!,
      color,
      emission,
      true,
    );
  }
}

function localRing(center: Vec3, corners: Vec3[], amount: number, radius: number) {
  return corners.map((corner) => insetCorner(center, corner, amount, radius));
}

function pushWallRing(geometry: MutableGeometry, lower: Vec3[], upper: Vec3[], color: Color, emission = 0) {
  for (let index = 0; index < lower.length; index += 1) {
    const next = (index + 1) % lower.length;
    pushTriangle(geometry, lower[index]!, lower[next]!, upper[next]!, color, emission);
    pushTriangle(geometry, lower[index]!, upper[next]!, upper[index]!, color, emission);
  }
}

function pushHeavenfall(geometry: MutableGeometry, cell: F28Cell) {
  const stone: Color = [0.36, 0.42, 0.46];
  const upperStone: Color = [0.52, 0.60, 0.64];
  const basin: Color = [0.16, 0.28, 0.34];
  const beam: Color = [0.72, 0.94, 1.0];
  const lower = localRing(cell.center, cell.corners, 0.72, 1.008);
  const upper = localRing(cell.center, cell.corners, 0.58, 1.035);
  pushWallRing(geometry, lower, upper, stone);
  const plateauCenter = scale(cell.center, 1.035);
  for (let index = 0; index < upper.length; index += 1) {
    pushTriangle(geometry, plateauCenter, upper[index]!, upper[(index + 1) % upper.length]!, upperStone);
  }
  const basinRing = localRing(cell.center, cell.corners, 0.18, 1.038);
  for (let index = 0; index < basinRing.length; index += 1) {
    pushTriangle(geometry, scale(cell.center, 1.033), basinRing[(index + 1) % basinRing.length]!, basinRing[index]!, basin);
  }
  const beamLower = localRing(cell.center, cell.corners, 0.055, 1.041);
  const beamUpper = localRing(cell.center, cell.corners, 0.035, 1.205);
  pushWallRing(geometry, beamLower, beamUpper, beam, 1.35);
  const beamTop = scale(cell.center, 1.205);
  for (let index = 0; index < beamUpper.length; index += 1) {
    pushTriangle(geometry, beamTop, beamUpper[index]!, beamUpper[(index + 1) % beamUpper.length]!, beam, 1.35);
  }
}

function pushEarthFocus(geometry: MutableGeometry, cell: F28Cell) {
  const darkRock: Color = [0.20, 0.18, 0.16];
  const midRock: Color = [0.34, 0.31, 0.27];
  const highRock: Color = [0.50, 0.47, 0.41];
  const base = localRing(cell.center, cell.corners, 0.78, 1.009);
  const shoulder = localRing(cell.center, cell.corners, 0.40, 1.052);
  pushWallRing(geometry, base, shoulder, darkRock);
  const peak = scale(cell.center, 1.155);
  for (let index = 0; index < shoulder.length; index += 1) {
    const color = index % 2 === 0 ? midRock : highRock;
    pushTriangle(geometry, shoulder[index]!, shoulder[(index + 1) % shoulder.length]!, peak, color);
  }
}

const neutralTileColor = (index: number): Color => {
  const mixed = ((index * 1103515245 + 12345) >>> 16) & 3;
  return mixed === 0 || mixed === 3 ? [0.075, 0.085, 0.095] : [0.42, 0.46, 0.50];
};

export function createF28RenderGeometry(): F28RenderGeometry {
  cachedGeodesic ??= makeTriangulatedGeodesic();
  const cells = createF28Cells();
  const geometry: MutableGeometry = { colors: [], emissions: [], normals: [], positions: [] };

  const rotatedVertices = cachedGeodesic.vertices.map((vertex) => scale(normalize(rotateLocked(vertex)), CORE_RADIUS));
  for (const [aIndex, bIndex, cIndex] of cachedGeodesic.triangles) {
    pushTriangle(
      geometry,
      rotatedVertices[aIndex]!,
      rotatedVertices[bIndex]!,
      rotatedVertices[cIndex]!,
      [0.008, 0.010, 0.014],
      0,
      true,
    );
  }

  cells.forEach((cell, index) => {
    const color: Color = cell.pentagonTileId === "PENT_HEAVENFALL"
      ? [0.18, 0.25, 0.29]
      : cell.pentagonTileId === "PENT_EARTH_FOCUS"
        ? [0.16, 0.14, 0.12]
        : neutralTileColor(index);
    pushPolygonFan(geometry, cell.center, cell.corners, color);
  });

  const heavenfall = cells.find((cell) => cell.pentagonTileId === "PENT_HEAVENFALL");
  const earthFocus = cells.find((cell) => cell.pentagonTileId === "PENT_EARTH_FOCUS");
  if (heavenfall) pushHeavenfall(geometry, heavenfall);
  if (earthFocus) pushEarthFocus(geometry, earthFocus);

  return {
    colors: new Float32Array(geometry.colors),
    emissions: new Float32Array(geometry.emissions),
    normals: new Float32Array(geometry.normals),
    positions: new Float32Array(geometry.positions),
    vertexCount: geometry.positions.length / 3,
  };
}
