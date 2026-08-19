import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "prisma/schema.prisma");
const registryPath = resolve(root, "src/content/entities.ts");
const outputPath = resolve(root, "src/data/entity-admin-contract.json");

const [schema, registry] = await Promise.all([
  readFile(schemaPath, "utf8"),
  readFile(registryPath, "utf8"),
]);

const modelBlocks = new Map(
  [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((match) => [match[1], match[2]]),
);
const modelNames = new Set(modelBlocks.keys());
const enums = new Map(
  [...schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((match) => [
    match[1],
    match[2].split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("//")),
  ]),
);

const registered = new Map();
for (const match of registry.matchAll(/^\s{2}(\w+): \[([^\]]*)\],$/gm)) {
  registered.set(match[1], [...match[2].matchAll(/"([^"]+)"/g)].map((field) => field[1]));
}

function parsedModelFields(block) {
  const fields = [];
  for (const line of block.split("\n")) {
    const field = /^\s{2}(\w+)\s+([A-Za-z][A-Za-z0-9]*)(\[\])?(\?)?(?:\s+.*)?$/.exec(line);
    if (!field) continue;
    const [, name, type, listMarker, optionalMarker] = field;
    const kind = modelNames.has(type) ? "relation" : enums.has(type) ? "enum" : type === "Json" ? "json" : "scalar";
    const relationFields = kind === "relation" ? /@relation\([^)]*fields:\s*\[([^\]]*)\]/.exec(line)?.[1] : undefined;
    fields.push({
      enumValues: enums.get(type) ?? [], hasDefault: line.includes("@default("), isId: line.includes("@id"), isList: Boolean(listMarker), isRequired: !optionalMarker,
      kind, name, relationFromFields: kind === "relation" ? [...(relationFields ?? "").matchAll(/\w+/g)].map((match) => match[0]) : undefined, type,
    });
  }
  return fields;
}

const auditModels = Object.fromEntries([...modelBlocks].sort(([left], [right]) => left.localeCompare(right)).map(([model, block]) => [model, {
  fields: parsedModelFields(block).map((field) => ({ enumName: field.kind === "enum" ? field.type : null, isList: field.isList, isRequired: field.isRequired, kind: field.kind, name: field.name, relationFromFields: field.relationFromFields, type: field.type })),
}]));

const entities = {};
for (const [entity, registeredFields] of [...registered].sort(([left], [right]) => left.localeCompare(right))) {
  if (entity === "CapabilityDefinition") continue;
  const block = modelBlocks.get(entity);
  if (!block) throw new Error(`Registered entity ${entity} has no Prisma model.`);
  const auditFields = parsedModelFields(block);
  const parsedFields = new Map(auditFields.filter((field) => field.kind !== "relation").map((field) => [field.name, field]));
  const fields = registeredFields.map((field) => {
    const parsed = parsedFields.get(field);
    if (!parsed) throw new Error(`Registered field ${entity}.${field} is not a scalar Prisma field.`);
    return parsed;
  });
  const identityFields = fields.filter((field) => field.isId);
  if (identityFields.length !== 1) throw new Error(`Registered entity ${entity} must expose exactly one scalar Prisma @id field.`);
  entities[entity] = {
    auditFields: auditFields.map((field) => ({
      editability: registeredFields.includes(field.name) ? "EDITABLE" : "EXCLUDED",
      exclusionReason: registeredFields.includes(field.name) ? null : field.kind === "relation" ? "Relation is edited through its owning canonical foreign-key field or workflow." : "Persisted field is audited but intentionally excluded from this generic form.",
      enumName: field.kind === "enum" ? field.type : null,
      isList: field.isList,
      isRequired: field.isRequired,
      kind: field.kind,
      name: field.name,
      relationFromFields: field.relationFromFields,
      type: field.type,
    })),
    delegate: `${entity[0].toLowerCase()}${entity.slice(1)}`,
    fields: fields.map((field) => {
      const output = { ...field };
      delete output.isId;
      return output;
    }),
    idField: identityFields[0].name,
  };
}

await writeFile(outputPath, `${JSON.stringify({ auditModels, entities, generatedFrom: ["prisma/schema.prisma", "src/content/entities.ts"], policy: "Prisma supplies complete persisted field discovery; content/entities.ts supplies generic-form editability only." }, null, 2)}\n`);
// eslint-disable-next-line no-undef
console.log(`entity-admin-contract ${Object.keys(entities).length} entities`);
