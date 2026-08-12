export interface PlannerAssignment {
  awarenessSkill: string | null;
  breedId: string;
  companionKey: string;
  faction: "CONCORD" | "RUIN" | "SCHISM";
  knowledgeSkill: string | null;
  occupationId: string;
  primaryAttribute: string;
  secondaryAttribute: string;
  worldKey: "CONCORD" | "RUIN" | "SCHISM";
}

export interface PlannerValidationIssue { cell: string; message: string }

export function validateCompanionPlanner(assignments: readonly PlannerAssignment[], affinities: ReadonlyMap<string, ReadonlySet<string>>): PlannerValidationIssue[] {
  const issues: PlannerValidationIssue[] = [];
  const duplicate = (property: keyof Pick<PlannerAssignment, "breedId" | "occupationId" | "knowledgeSkill" | "awarenessSkill">, nullable = false) => {
    const seen = new Map<string, PlannerAssignment>();
    for (const assignment of assignments) {
      const value = assignment[property];
      if (nullable && value === null) continue;
      const key = `${assignment.worldKey}:${value}`;
      const prior = seen.get(key);
      if (prior) {
        for (const row of [prior, assignment]) issues.push({ cell: `${row.worldKey}.${row.companionKey}.${property}`, message: `${String(value)} must be unique within ${row.worldKey}.` });
      } else seen.set(key, assignment);
    }
  };
  duplicate("breedId"); duplicate("occupationId"); duplicate("knowledgeSkill", true); duplicate("awarenessSkill", true);

  const pairSeen = new Map<string, PlannerAssignment>();
  for (const assignment of assignments) {
    const pair = `${assignment.primaryAttribute}:${assignment.secondaryAttribute}`;
    const prior = pairSeen.get(pair);
    if (prior) {
      issues.push({ cell: `${prior.worldKey}.${prior.companionKey}.attributes`, message: `Attribute pair ${pair} must be unique across all assignments.` });
      issues.push({ cell: `${assignment.worldKey}.${assignment.companionKey}.attributes`, message: `Attribute pair ${pair} must be unique across all assignments.` });
    } else pairSeen.set(pair, assignment);
    const allowed = affinities.get(assignment.occupationId);
    if (!allowed?.has(assignment.primaryAttribute) || !allowed.has(assignment.secondaryAttribute)) issues.push({ cell: `${assignment.worldKey}.${assignment.companionKey}.attributes`, message: "Both attributes must belong to the selected Occupation affinity." });
  }

  for (const companionKey of new Set(assignments.map((assignment) => assignment.companionKey))) {
    const rows = assignments.filter((assignment) => assignment.companionKey === companionKey);
    const factions = new Set(rows.map((assignment) => assignment.faction));
    if (rows.length !== 3 || factions.size !== 3 || !["CONCORD", "RUIN", "SCHISM"].every((faction) => factions.has(faction as PlannerAssignment["faction"]))) {
      for (const row of rows) issues.push({ cell: `${row.worldKey}.${companionKey}.faction`, message: "Each companion must use Concord, Ruin, and Schism faction exactly once." });
    }
  }
  return issues.filter((issue, index, rows) => rows.findIndex((candidate) => candidate.cell === issue.cell && candidate.message === issue.message) === index);
}
