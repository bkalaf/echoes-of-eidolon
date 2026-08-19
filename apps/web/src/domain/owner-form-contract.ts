import { adminFieldControl, type AdminFieldControl, type EntityFormField } from "./entity-form";
import { orderOwnerTableFields } from "./owner-table-field-order";

type AuditField = {
  editability: "EDITABLE" | "EXCLUDED";
  exclusionReason: string | null;
  enumName?: string | null;
  isList: boolean;
  isRequired: boolean;
  kind: "enum" | "json" | "relation" | "scalar";
  name: string;
  relationFromFields?: string[];
  type: string;
};

type OwnerFormContract = {
  auditFields: AuditField[];
  fields: EntityFormField[];
  idField: string;
};

export type OwnerFormControl = AdminFieldControl | "RELATION_LOOKUP" | "SPECTRAL_COLOR" | "READ_ONLY";

export type OwnerFormFieldPlan = AuditField & {
  control: OwnerFormControl;
  relationField: string | null;
  relationType: string | null;
  section: string;
  treatment: "INPUT" | "READ_ONLY";
};

const subtypeParents: Record<string, string> = {
  Architect: "Character",
  Companion: "Character",
  Witness: "Character",
};

const exactSections: Record<string, string[]> = {
  Architect: ["Character identity", "Architect subtype", "Related / Read-only"],
  Companion: ["Character identity", "Companion subtype", "Related / Read-only"],
  CompanionDef: ["Identity", "Soul", "Linked Characters", "Companion Definition", "Related / Read-only"],
  Witness: ["Character identity", "Witness definition", "Architect continuity", "Witness-specific fields", "Related / Read-only"],
  WitnessDef: ["Identity", "Source Architect / Soul", "Domains", "Spectral Color", "Related / Read-only"],
};

export function subtypeParentEntity(entity: string): string | null {
  return subtypeParents[entity] ?? null;
}

export function ownerFormSections(entity: string): string[] {
  return exactSections[entity] ?? ["Identity", "Classification", "Relations", "Details", "Collections", "Presentation", "Structured data", "Related / Read-only"];
}

function sectionFor(entity: string, field: AuditField, idField: string): string {
  if (entity === "WitnessDef") {
    if (["name", "witnessDefId", "department"].includes(field.name)) return "Identity";
    if (["architectSoul", "architectSoulId"].includes(field.name)) return "Source Architect / Soul";
    if (["apparentDomain", "realDomain"].includes(field.name)) return "Domains";
    if (field.name === "color") return "Spectral Color";
    return "Related / Read-only";
  }
  if (entity === "CompanionDef") {
    if (field.name === "companionKey") return "Identity";
    if (["soul", "soulId"].includes(field.name)) return "Soul";
    if (/^(concord|ruin|schism)Character(Id)?$/.test(field.name)) return "Linked Characters";
    return field.editability === "EXCLUDED" ? "Related / Read-only" : "Companion Definition";
  }
  if (subtypeParentEntity(entity)) {
    if (field.name === "character" || field.name === "characterId") return "Character identity";
    if (entity === "Witness" && ["witnessDef", "witnessDefId"].includes(field.name)) return "Witness definition";
    if (entity === "Witness" && ["architect", "architectCharacterId"].includes(field.name)) return "Architect continuity";
    if (field.editability === "EXCLUDED") return "Related / Read-only";
    return entity === "Witness" ? "Witness-specific fields" : `${entity} subtype`;
  }
  if (["displayName", "name", "title", "term", idField].includes(field.name)) return "Identity";
  if (field.kind === "relation" || field.name.endsWith("Id")) return "Relations";
  if (field.isList) return "Collections";
  if (field.kind === "json") return "Structured data";
  if (["description", "summary", "appearance", "clothing", "architecture", "rendering", "expression"].includes(field.name)) return "Presentation";
  if (field.kind === "enum" || ["status", "classification", "worldKey", "type", "kind"].some((token) => field.name.includes(token))) return "Classification";
  return field.editability === "EXCLUDED" ? "Related / Read-only" : "Details";
}

export function buildOwnerFormPlan(entity: string, contract: OwnerFormContract): OwnerFormFieldPlan[] {
  const editableByName = new Map(contract.fields.map((field) => [field.name, field]));
  const relationByForeignKey = new Map<string, AuditField>();
  for (const relation of contract.auditFields.filter((field) => field.kind === "relation")) {
    for (const foreignKey of relation.relationFromFields ?? []) relationByForeignKey.set(foreignKey, relation);
  }
  return orderOwnerTableFields(entity, contract.idField, contract.auditFields).map((field) => {
    const editable = editableByName.get(field.name);
    const relation = relationByForeignKey.get(field.name);
    const treatment = editable ? "INPUT" as const : "READ_ONLY" as const;
    const control: OwnerFormControl = !editable
      ? "READ_ONLY"
      : entity === "WitnessDef" && field.name === "color"
        ? "SPECTRAL_COLOR"
        : relation
          ? "RELATION_LOOKUP"
          : adminFieldControl(entity, contract.idField, editable);
    return {
      ...field,
      control,
      relationField: relation?.name ?? null,
      relationType: relation?.type ?? null,
      section: sectionFor(entity, field, contract.idField),
      treatment,
    };
  });
}
