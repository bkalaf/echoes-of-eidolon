import { LatticeId, RegionId } from "../generated/prisma/enums";
import type { CanonicalAtlasConnection, CanonicalRegionLatticeMapping } from "../data/atlas-topology";

export class AtlasTopologyError extends Error {
  override name = "AtlasTopologyError";
}

export interface AtlasTopology {
  connections: readonly CanonicalAtlasConnection[];
  mappings: readonly CanonicalRegionLatticeMapping[];
}

const regionIds = new Set<string>(Object.values(RegionId));
const latticeIds = new Set<string>(Object.values(LatticeId));

export function validateAtlasTopology(topology: AtlasTopology): AtlasTopology {
  if (topology.mappings.length !== 25) throw new AtlasTopologyError("Atlas Region Mapping must contain exactly 25 rows.");
  const mappedRegions = new Set<string>();
  const mappedLattices = new Set<string>();
  for (const mapping of topology.mappings) {
    if (!regionIds.has(mapping.regionId) || !latticeIds.has(mapping.latticeId) || !mapping.locked) throw new AtlasTopologyError("Atlas Region Mapping contains an invalid or unlocked identity.");
    if (mappedRegions.has(mapping.regionId) || mappedLattices.has(mapping.latticeId)) throw new AtlasTopologyError("Atlas Region Mapping must be one-to-one.");
    mappedRegions.add(mapping.regionId);
    mappedLattices.add(mapping.latticeId);
  }
  if (topology.connections.length !== 44) throw new AtlasTopologyError("Atlas topology must contain exactly 44 connections.");
  const pairs = new Set<string>();
  const counts = { BASE: 0, LEFT_RIGHT_CROSSOVER: 0, NORMAL: 0 };
  for (const connection of topology.connections) {
    if (!latticeIds.has(connection.fromLatticeId) || !latticeIds.has(connection.toLatticeId) || connection.fromLatticeId === connection.toLatticeId || !connection.locked) {
      throw new AtlasTopologyError("Atlas connection endpoints must be distinct locked LatticeIds.");
    }
    const pair = [connection.fromLatticeId, connection.toLatticeId].sort().join(":");
    if (pairs.has(pair)) throw new AtlasTopologyError("Atlas connections must be unique undirected pairs.");
    pairs.add(pair);
    counts[connection.connectionType] += 1;
    const crossover = connection.connectionType === "LEFT_RIGHT_CROSSOVER";
    if ((crossover && connection.wrapMode !== "DATE_LINE") || (!crossover && connection.wrapMode !== "NONE")) {
      throw new AtlasTopologyError("Atlas connection wrap mode does not match its connection type.");
    }
  }
  if (counts.BASE !== 38 || counts.NORMAL !== 1 || counts.LEFT_RIGHT_CROSSOVER !== 5) throw new AtlasTopologyError("Atlas connection type cardinality is invalid.");
  if (!topology.connections.some((connection) => connection.connectionType === "NORMAL" && connection.fromLatticeId === "L04" && connection.toLatticeId === "L11")) {
    throw new AtlasTopologyError("Atlas NORMAL connection must be L04 to L11.");
  }
  return topology;
}

export function latticeForRegion(topology: AtlasTopology, regionId: RegionId): LatticeId {
  const mapping = topology.mappings.find((candidate) => candidate.regionId === regionId);
  if (!mapping) throw new AtlasTopologyError(`Region ${regionId} has no authoritative Lattice mapping.`);
  return mapping.latticeId;
}

export function regionForLattice(topology: AtlasTopology, latticeId: LatticeId): RegionId {
  const mapping = topology.mappings.find((candidate) => candidate.latticeId === latticeId);
  if (!mapping) throw new AtlasTopologyError(`Lattice ${latticeId} has no authoritative Region mapping.`);
  return mapping.regionId;
}
