/**
 * Author: Preston Lee
 *
 * Reads terminology CSV files listed in manifest.csv and creates corresponding
 * FHIR R4 ValueSet resources in fhir/. Descriptions come from the manifest.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const MANIFEST_PATH = path.join(ROOT, "manifest.csv");
const TERMINOLOGY_DIR = path.join(ROOT, "terminology");
const OUTPUT_DIR = path.join(ROOT, "fhir");

/** Map code system display names to FHIR code system URIs */
const CODE_SYSTEM_URIS: Record<string, string> = {
  "ICD-10-CM": "http://hl7.org/fhir/sid/icd-10-cm",
  "ICD-9-CM Diagnosis": "http://hl7.org/fhir/sid/icd-9-cm",
  "SNOMED CT US Edition": "http://snomed.info/sct",
};

/** Parse a single CSV line respecting quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((l) => parseCsvLine(l));
  return { headers, rows };
}

function toFhirSystemUri(codeSystemName: string): string {
  const uri = CODE_SYSTEM_URIS[codeSystemName];
  if (uri) return uri;
  return `urn:oid:unknown/${encodeURIComponent(codeSystemName)}`;
}

/** Create a URL-safe id from value set name (e.g. "Cardiovascular Diseases" -> "cardiovascular-diseases") */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Escape text for safe use inside XHTML */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build FHIR R4 ValueSet from parsed CSV data */
function buildValueSet(
  valueSetName: string,
  description: string,
  valueSetOID: string | undefined,
  valueSetVersion: string | undefined,
  rows: Record<string, string>[]
): fhir4.ValueSet {
  const slug = toSlug(valueSetName);
  const baseUrl = "https://asu.edu/fhir/ValueSet";

  const includeBySystem = new Map<string, fhir4.ValueSetComposeInclude>();

  for (const row of rows) {
    const code = row["Source Code"];
    const display = row["Term Original"];
    const codeSystemName = row["Code System Name"];
    const codeSystemVersion = row["Code System Version"];
    if (!code || !codeSystemName) continue;

    const system = toFhirSystemUri(codeSystemName);
    const key = `${system}|${codeSystemVersion ?? ""}`;
    if (!includeBySystem.has(key)) {
      includeBySystem.set(key, {
        system,
        version: codeSystemVersion || undefined,
        concept: [],
      });
    }
    const include = includeBySystem.get(key)!;
    (include.concept ??= []).push({ code: String(code).trim(), display: display || undefined });
  }

  const compose = {
    include: Array.from(includeBySystem.values()),
  };

  const identifier: fhir4.Identifier[] = [];
  if (valueSetOID) {
    identifier.push({
      system: "urn:uuid",
      value: valueSetOID,
    });
  }

  const conceptCount = Array.from(includeBySystem.values()).reduce(
    (n, inc) => n + (inc.concept?.length ?? 0),
    0
  );
  const systemCount = includeBySystem.size;

  const narrativeDiv = [
    `<div xmlns="http://www.w3.org/1999/xhtml">`,
    `  <h2>${escapeHtml(valueSetName)}</h2>`,
    `  <p>${escapeHtml(description.trim())}</p>`,
    `  <p>Contains ${conceptCount} concept(s) from ${systemCount} code system(s).</p>`,
    `</div>`,
  ].join("\n");

  const valueSet: fhir4.ValueSet = {
    resourceType: "ValueSet",
    id: slug,
    url: `${baseUrl}/${slug}`,
    ...(identifier.length > 0 && { identifier }),
    ...(valueSetVersion && { version: valueSetVersion }),
    name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s/g, ""),
    title: valueSetName,
    status: "active",
    experimental: false,
    date: new Date().toISOString().slice(0, 10),
    publisher: "ASU CDS",
    description: description.trim(),
    text: { status: "generated" as const, div: narrativeDiv },
    compose,
  };

  return valueSet;
}

function main(): void {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("Manifest not found:", MANIFEST_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(TERMINOLOGY_DIR)) {
    console.error("Terminology directory not found:", TERMINOLOGY_DIR);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const manifestContent = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const { headers: manifestHeaders, rows: manifestRows } = parseCsv(manifestContent);
  const pathIdx = manifestHeaders.indexOf("path");
  const descIdx = manifestHeaders.indexOf("description");
  if (pathIdx < 0 || descIdx < 0) {
    console.error("Manifest must have 'path' and 'description' columns");
    process.exit(1);
  }

  const rowToObj = (cells: string[], headers: string[]): Record<string, string> => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  };

  for (const manifestRow of manifestRows) {
    const relPath = manifestRow[pathIdx]?.trim();
    const description = manifestRow[descIdx]?.trim();
    if (!relPath) continue;

    const fileName = path.basename(relPath);
    const filePath = path.join(TERMINOLOGY_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn("Terminology file not found, skipping:", filePath);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const { headers, rows } = parseCsv(content);

    const records = rows.map((cells) => rowToObj(cells, headers)).filter((r) => r["Source Code"]?.trim());
    if (records.length === 0) {
      console.warn("Skipping (no data rows):", fileName);
      continue;
    }

    const first = records[0];
    const valueSetName = first["Value Set Name"]?.trim() || path.basename(fileName, ".csv");
    const valueSetOID = first["Value Set OID"]?.trim();
    const valueSetVersion = first["Value Set Version"]?.trim();

    const valueSet = buildValueSet(
      valueSetName,
      description || `Value set: ${valueSetName}.`,
      valueSetOID,
      valueSetVersion,
      records
    );
    const slug = toSlug(valueSetName);
    const outPath = path.join(OUTPUT_DIR, `${slug}.json`);
    const jsonStr = JSON.stringify(valueSet, null, 2);
    fs.writeFileSync(outPath, jsonStr, "utf-8");
    console.log("Wrote", outPath);
  }
}

main();
