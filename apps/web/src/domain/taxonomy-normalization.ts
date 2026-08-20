export const TAXONOMY_TYPES = ["KINGDOM", "PHYLUM", "CLASS", "ORDER", "FAMILY", "GENUS", "SPECIES"] as const;

export type TaxonomyType = typeof TAXONOMY_TYPES[number];

export interface EmbeddedTaxonomyNode {
  taxonomyLevelId: string;
  type: TaxonomyType;
  name: string;
  isOfficial: boolean;
  text?: string | null;
  commonName?: string | null;
  parent?: EmbeddedTaxonomyNode | null;
}

export interface SpeciesTaxonomyPreflightRow {
  speciesId: string;
  speciesName: string;
  existingTaxonomy: EmbeddedTaxonomyNode | null;
}

export interface NormalizedTaxonomyNode {
  taxonomyLevelId: string;
  type: TaxonomyType;
  name: string;
  commonName: string | null;
  text: string | null;
  isOfficial: boolean;
  parentTaxonomyLevelId: string | null;
  usedBySpeciesIds: string[];
}

export interface TaxonomyConflict {
  taxonomyLevelId: string;
  variants: Array<{
    type: TaxonomyType;
    name: string;
    commonName: string | null;
    text: string | null;
    isOfficial: boolean;
    parentTaxonomyLevelId: string | null;
    speciesIds: string[];
  }>;
}

type CanonicalOverride = Pick<NormalizedTaxonomyNode, "name" | "parentTaxonomyLevelId"> & Partial<Pick<NormalizedTaxonomyNode, "isOfficial">>;

/**
 * Explicit repairs for duplicated TAX identities found in the 2026-08-20
 * read-only production export. These choose an already represented canonical
 * parent, remove casing-only drift, and fill incomplete parent links. The one
 * true identity collision (official Draco vs manufactured Draco) is split in
 * normalizeIdentity so neither lineage is discarded.
 */
export const TAXONOMY_CANONICAL_OVERRIDES: Readonly<Record<string, CanonicalOverride>> = Object.freeze({
  TAX_KINGDOM_ANIMALIA: { name: "Animalia", parentTaxonomyLevelId: null },
  TAX_CLASS_MAMMALIA: { name: "Mammalia", parentTaxonomyLevelId: "TAX_PHYLUM_CHORDATA" },
  TAX_PHYLUM_CHORDATA: { name: "Chordata", parentTaxonomyLevelId: "TAX_KINGDOM_ANIMALIA" },
  TAX_ORDER_SQUAMATA: { name: "Squamata", parentTaxonomyLevelId: "TAX_CLASS_REPTILIA" },
  TAX_FAMILY_ELAPIDAE: { name: "Elapidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_FAMILY_ALLIGATORIDAE: { name: "Alligatoridae", parentTaxonomyLevelId: "TAX_ORDER_CROCODYLIA" },
  TAX_FAMILY_IGUANIDAE: { name: "Iguanidae", parentTaxonomyLevelId: "TAX_ORDER_SAURIA" },
  TAX_FAMILY_ANGUIDAE: { name: "Anguidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_GENUS_ANOLIS: { name: "Anolis", parentTaxonomyLevelId: "TAX_FAMILY_DACTYLOIDAE" },
  TAX_CLASS_REPTILIA: { name: "Reptilia", parentTaxonomyLevelId: "TAX_PHYLUM_CHORDATA" },
  TAX_ORDER_TESTUDINES: { name: "Testudines", parentTaxonomyLevelId: "TAX_CLASS_REPTILIA" },
  TAX_FAMILY_TEIIDAE: { name: "Teiidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_ORDER_RODENTIA: { name: "Rodentia", parentTaxonomyLevelId: "TAX_CLASS_MAMMALIA" },
  TAX_GENUS_ATRACTASPIS: { name: "Atractaspis", parentTaxonomyLevelId: "TAX_FAMILY_LAMPROPHIIDAE" },
  TAX_FAMILY_BOIDAE: { name: "Boidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_GENUS_CHINCHILLA: { name: "Chinchilla", parentTaxonomyLevelId: "TAX_FAMILY_CHINCHILLIDAE" },
  TAX_FAMILY_AGAMIDAE: { name: "Agamidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_FAMILY_ERETHIZONTIDAE: { name: "Erethizontidae", parentTaxonomyLevelId: "TAX_ORDER_RODENTIA" },
  TAX_FAMILY_CICHLIDAE: { name: "Cichlidae", parentTaxonomyLevelId: "TAX_ORDER_CICHLIFORMES" },
  TAX_FAMILY_GEKKONIDAE: { name: "Gekkonidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_FAMILY_COLUBRIDAE: { name: "Colubridae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_FAMILY_PYTHONIDAE: { name: "Pythonidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
  TAX_GENUS_VARANUS: { name: "Varanus", parentTaxonomyLevelId: "TAX_FAMILY_VARANIDAE" },
  TAX_FAMILY_VARANIDAE: { name: "Varanidae", parentTaxonomyLevelId: "TAX_ORDER_SQUAMATA" },
});

function canonicalTaxonomyLevelId(type: TaxonomyType, name: string): string {
  const token = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `TAX_${type}_${token}`;
}

function normalizeIdentity(node: EmbeddedTaxonomyNode): { taxonomyLevelId: string; name: string; isOfficial: boolean } {
  if (node.taxonomyLevelId === "TAX_GENUS_DRACO" && node.isOfficial === false) {
    return { taxonomyLevelId: "TAX_GENUS_DRACO_MYTHOS", name: "Draco Mythos", isOfficial: false };
  }
  const override = TAXONOMY_CANONICAL_OVERRIDES[node.taxonomyLevelId];
  return {
    taxonomyLevelId: node.taxonomyLevelId,
    name: override?.name ?? node.name,
    isOfficial: override?.isOfficial ?? node.isOfficial,
  };
}

function normalizedParentId(node: EmbeddedTaxonomyNode): string | null {
  if (node.taxonomyLevelId === "TAX_GENUS_DRACO" && node.isOfficial === false) return "TAX_FAMILY_DRACOIDAE";
  const override = TAXONOMY_CANONICAL_OVERRIDES[node.taxonomyLevelId];
  if (override) return override.parentTaxonomyLevelId;
  return node.parent ? normalizeIdentity(node.parent).taxonomyLevelId : null;
}

function canonicalFacts(node: EmbeddedTaxonomyNode): Omit<NormalizedTaxonomyNode, "usedBySpeciesIds"> {
  const identity = normalizeIdentity(node);
  return {
    ...identity,
    type: node.type,
    commonName: node.commonName?.trim() || null,
    text: node.text?.trim() || null,
    parentTaxonomyLevelId: normalizedParentId(node),
  };
}

function sourceFacts(node: EmbeddedTaxonomyNode): Omit<NormalizedTaxonomyNode, "usedBySpeciesIds"> {
  return {
    taxonomyLevelId: node.taxonomyLevelId,
    type: node.type,
    name: node.name,
    commonName: node.commonName?.trim() || null,
    text: node.text?.trim() || null,
    isOfficial: node.isOfficial,
    parentTaxonomyLevelId: node.parent?.taxonomyLevelId ?? null,
  };
}

function factKey(node: Omit<NormalizedTaxonomyNode, "usedBySpeciesIds">): string {
  return JSON.stringify(node);
}

function conflictVariants(values: Array<Omit<NormalizedTaxonomyNode, "usedBySpeciesIds"> & { speciesId: string }>): TaxonomyConflict["variants"] {
  const variants = new Map<string, TaxonomyConflict["variants"][number]>();
  for (const { speciesId, ...facts } of values) {
    const key = factKey(facts);
    const existing = variants.get(key);
    if (existing) existing.speciesIds.push(speciesId);
    else variants.set(key, { ...facts, speciesIds: [speciesId] });
  }
  return [...variants.values()].map((variant) => ({ ...variant, speciesIds: [...new Set(variant.speciesIds)].sort() }));
}

export function normalizeTaxonomyPreflight(rows: readonly SpeciesTaxonomyPreflightRow[]) {
  const occurrences = new Map<string, Array<Omit<NormalizedTaxonomyNode, "usedBySpeciesIds"> & { speciesId: string }>>();
  const sourceOccurrences = new Map<string, Array<Omit<NormalizedTaxonomyNode, "usedBySpeciesIds"> & { speciesId: string }>>();
  const speciesReferences: Array<{ speciesId: string; taxonomyLevelId: string | null }> = [];
  const structuralConflicts: TaxonomyConflict[] = [];

  for (const row of [...rows].sort((left, right) => left.speciesId.localeCompare(right.speciesId))) {
    speciesReferences.push({ speciesId: row.speciesId, taxonomyLevelId: row.existingTaxonomy ? normalizeIdentity(row.existingTaxonomy).taxonomyLevelId : null });
    const visitedObjects = new Set<EmbeddedTaxonomyNode>();
    let current = row.existingTaxonomy;
    while (current) {
      if (visitedObjects.has(current)) {
        structuralConflicts.push({ taxonomyLevelId: current.taxonomyLevelId, variants: [{ ...canonicalFacts(current), speciesIds: [row.speciesId] }] });
        break;
      }
      visitedObjects.add(current);
      const rawFacts = sourceFacts(current);
      const rawValues = sourceOccurrences.get(rawFacts.taxonomyLevelId) ?? [];
      rawValues.push({ ...rawFacts, speciesId: row.speciesId });
      sourceOccurrences.set(rawFacts.taxonomyLevelId, rawValues);
      const facts = canonicalFacts(current);
      const expectedId = canonicalTaxonomyLevelId(facts.type, facts.name);
      if (facts.taxonomyLevelId !== expectedId) {
        structuralConflicts.push({ taxonomyLevelId: facts.taxonomyLevelId, variants: [{ ...facts, speciesIds: [row.speciesId] }] });
      }
      const values = occurrences.get(facts.taxonomyLevelId) ?? [];
      values.push({ ...facts, speciesId: row.speciesId });
      occurrences.set(facts.taxonomyLevelId, values);
      current = current.parent ?? null;
    }
  }

  const sourceConflicts = [...sourceOccurrences]
    .map(([taxonomyLevelId, values]) => ({ taxonomyLevelId, variants: conflictVariants(values) }))
    .filter(({ variants }) => variants.length > 1)
    .sort((left, right) => left.taxonomyLevelId.localeCompare(right.taxonomyLevelId));

  const conflicts = [...structuralConflicts];
  const nodes: NormalizedTaxonomyNode[] = [];
  for (const [taxonomyLevelId, values] of [...occurrences].sort(([left], [right]) => left.localeCompare(right))) {
    const variants = conflictVariants(values);
    if (variants.length !== 1) {
      conflicts.push({ taxonomyLevelId, variants });
      continue;
    }
    const { speciesIds, ...facts } = variants[0]!;
    nodes.push({ taxonomyLevelId, ...facts, usedBySpeciesIds: speciesIds });
  }

  const nodeIds = new Set(nodes.map(({ taxonomyLevelId }) => taxonomyLevelId));
  for (const node of nodes) {
    if (node.parentTaxonomyLevelId && !nodeIds.has(node.parentTaxonomyLevelId)) {
      conflicts.push({ taxonomyLevelId: node.taxonomyLevelId, variants: [{ ...node, speciesIds: node.usedBySpeciesIds }] });
    }
  }

  for (const node of nodes) {
    const visited = new Set<string>();
    let current: NormalizedTaxonomyNode | undefined = node;
    while (current) {
      if (visited.has(current.taxonomyLevelId)) {
        conflicts.push({ taxonomyLevelId: node.taxonomyLevelId, variants: [{ ...node, speciesIds: node.usedBySpeciesIds }] });
        break;
      }
      visited.add(current.taxonomyLevelId);
      current = current.parentTaxonomyLevelId ? nodes.find(({ taxonomyLevelId }) => taxonomyLevelId === current!.parentTaxonomyLevelId) : undefined;
    }
  }

  return {
    schemaVersion: "eidolon-taxonomy-normalization-plan-v1" as const,
    speciesCount: rows.length,
    speciesWithTaxonomy: rows.filter(({ existingTaxonomy }) => existingTaxonomy !== null).length,
    speciesWithoutTaxonomy: rows.filter(({ existingTaxonomy }) => existingTaxonomy === null).length,
    uniqueTaxonomyNodeIds: nodes.length,
    nodes,
    speciesReferences,
    sourceConflicts,
    resolutionsApplied: sourceConflicts.map(({ taxonomyLevelId }) => taxonomyLevelId === "TAX_GENUS_DRACO"
      ? { taxonomyLevelId, resolution: "Split manufactured occurrences to TAX_GENUS_DRACO_MYTHOS; preserve official TAX_GENUS_DRACO." }
      : { taxonomyLevelId, resolution: TAXONOMY_CANONICAL_OVERRIDES[taxonomyLevelId] }),
    conflicts,
  };
}
