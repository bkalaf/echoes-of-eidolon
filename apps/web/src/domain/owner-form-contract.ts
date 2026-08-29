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
  label: string;
  relationField: string | null;
  relationType: string | null;
  section: string;
  technical: boolean;
  treatment: "INPUT" | "READ_ONLY";
};

const subtypeParents: Record<string, string> = {
  Architect: "Character",
  Companion: "Character",
  Witness: "Character",
};

const exactSections: Record<string, string[]> = {
  Architect: ["Architect identity", "Character presentation", "Architect subtype", "Soul continuity", "Appearance", "Technical details"],
  Companion: ["Character identity", "Companion subtype", "Related / Read-only", "Technical details"],
  CompanionDef: ["Identity", "Soul", "Linked Characters", "Companion Definition", "Related / Read-only", "Technical details"],
  Witness: ["Character", "Witness definition", "Source Architect", "Soul continuity", "Witness-specific narrative data", "Rewards / constellations", "Technical details"],
  WitnessDef: ["Identity", "Source Architect / Soul", "World / Book / Kernel", "Domains", "Spectral Color", "Related / Read-only", "Technical details"],
};

export function subtypeParentEntity(entity: string): string | null {
  return subtypeParents[entity] ?? null;
}

export function ownerFormSections(entity: string): string[] {
  return exactSections[entity] ?? ["Identity", "Classification", "Relations", "Details", "Collections", "Presentation", "Structured data", "Related / Read-only", "Technical details"];
}

function sectionFor(entity: string, field: AuditField, idField: string): string {
  if (field.name === idField) return "Technical details";
  if (entity === "WitnessDef") {
    if (["name", "department"].includes(field.name)) return "Identity";
    if (["worldKey", "bookNumber", "kernelKey"].includes(field.name)) return "World / Book / Kernel";
    if (["architectSoul", "architectSoulId"].includes(field.name)) return "Source Architect / Soul";
    if (["apparentDomain", "realDomain"].includes(field.name)) return "Domains";
    if (field.name === "color") return "Spectral Color";
    return "Related / Read-only";
  }
  if (entity === "CompanionDef") {
    if (["soul", "soulId"].includes(field.name)) return "Soul";
    if (/^(concord|ruin|schism)Character(Id)?$/.test(field.name)) return "Linked Characters";
    return field.editability === "EXCLUDED" ? "Related / Read-only" : "Companion Definition";
  }
  if (subtypeParentEntity(entity)) {
    if (field.name === "character" || field.name === "characterId") return entity === "Witness" ? "Technical details" : entity === "Architect" ? "Technical details" : "Character identity";
    if (entity === "Witness" && ["witnessDef", "witnessDefId"].includes(field.name)) return "Witness definition";
    if (entity === "Witness" && ["architect", "architectCharacterId"].includes(field.name)) return "Source Architect";
    if (entity === "Witness" && ["legendaryReward", "legendaryRewardId", "constellationBefore", "constellationBeforeId", "constellationAfter", "constellationAfterId"].includes(field.name)) return "Rewards / constellations";
    if (entity === "Witness") return "Witness-specific narrative data";
    return `${entity} subtype`;
  }
  if (["displayName", "name", "title", "term"].includes(field.name)) return "Identity";
  if (field.kind === "relation" || field.name.endsWith("Id")) return "Relations";
  if (field.isList) return "Collections";
  if (field.kind === "json") return "Structured data";
  if (["description", "summary", "appearance", "clothing", "architecture", "rendering", "expression"].includes(field.name)) return "Presentation";
  if (field.kind === "enum" || ["status", "classification", "worldKey", "type", "kind"].some((token) => field.name.includes(token))) return "Classification";
  return field.editability === "EXCLUDED" ? "Related / Read-only" : "Details";
}

export function humanizeOwnerFieldName(name: string): string {
  return name.replace(/Id$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase());
}

export function ownerParentSectionFor(entity: string, fieldName: string): string {
  if (fieldName === "characterId") return "Technical details";
  if (entity === "Witness") return "Character";
  if (fieldName === "displayName") return entity === "Architect" ? "Architect identity" : "Character identity";
  if (["skinScaleColor", "hairFurColor", "eyeColor", "clothing"].includes(fieldName)) return "Appearance";
  if (fieldName === "soulId") return "Soul continuity";
  if (["worldKey", "faction"].includes(fieldName)) return "World / faction";
  return "Character presentation";
}

export function buildOwnerFormPlan(entity: string, contract: OwnerFormContract): OwnerFormFieldPlan[] {
  const editableByName = new Map(contract.fields.map((field) => [field.name, field]));
  const relationByForeignKey = new Map<string, AuditField>();
  for (const relation of contract.auditFields.filter((field) => field.kind === "relation")) {
    for (const foreignKey of relation.relationFromFields ?? []) relationByForeignKey.set(foreignKey, relation);
  }
  const owningRelationNames = new Set(contract.auditFields.filter((field) => field.kind === "relation" && field.relationFromFields?.length).map((field) => field.name));
  return orderOwnerTableFields(entity, contract.idField, contract.auditFields).filter((field) => !owningRelationNames.has(field.name)).map((field) => {
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
      label: field.name === contract.idField ? "Technical ID" : relation ? humanizeOwnerFieldName(relation.name) : humanizeOwnerFieldName(field.name),
      relationField: relation?.name ?? null,
      relationType: relation?.type ?? null,
      section: sectionFor(entity, field, contract.idField),
      technical: field.name === contract.idField,
      treatment,
    };
  });
}
