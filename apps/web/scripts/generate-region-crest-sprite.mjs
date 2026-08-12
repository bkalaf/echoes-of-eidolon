import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const crestDirectory = resolve(scriptDirectory, "../public/crests");
const spritePath = resolve(crestDirectory, "region-crests.svg");
const crestFilePattern = /^R\d{2}(?:-[CRS])?\.svg$/;

function normalizeSemanticPaint(source) {
  return source.replace(/\b(fill|stroke)=(['"])([^'"]+)\2/gi, (attribute, property, quote, rawValue) => {
    const value = rawValue.trim().toLowerCase().replace(/\s+/g, "");
    if (["black", "#000", "#000000", "rgb(0,0,0)"].includes(value)) return `${property}=${quote}currentColor${quote}`;
    if (["white", "#fff", "#ffffff", "rgb(255,255,255)"].includes(value)) return `${property}=${quote}#fff${quote}`;
    return attribute;
  });
}

const crestFileNames = (await readdir(crestDirectory)).filter((fileName) => crestFilePattern.test(fileName)).sort();
const symbols = [];

for (const fileName of crestFileNames) {
  const source = await readFile(resolve(crestDirectory, fileName), "utf8");
  const root = source.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  const viewBox = root?.[1].match(/\bviewBox=(['"])([^'"]+)\1/i)?.[2];
  if (!root || !viewBox) throw new Error(`Crest ${fileName} does not contain one SVG root with a viewBox.`);
  const symbolId = `crest-${fileName.replace(/\.svg$/i, "")}`;
  symbols.push(`<symbol id="${symbolId}" viewBox="${viewBox}">${normalizeSemanticPaint(root[2])}</symbol>`);
}

const sprite = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols.join("")}</defs></svg>\n`;
await writeFile(spritePath, sprite, "utf8");
globalThis.console.log(`region-crest-sprite ${crestFileNames.length} symbols`);
