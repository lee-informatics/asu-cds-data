/**
 * Reads each FHIR ValueSet JSON file from value-sets/ and writes an identically-named
 * file to bundles/ with the ValueSet wrapped in a FHIR Bundle (type: transaction).
 *
 * Run: npx tsx bin/bundle-value-sets.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const VALUE_SETS_DIR = path.join(ROOT, "value-sets");
const BUNDLES_DIR = path.join(ROOT, "bundles");

function main(): void {
  if (!fs.existsSync(VALUE_SETS_DIR)) {
    console.error("Directory not found:", VALUE_SETS_DIR);
    process.exit(1);
  }

  fs.mkdirSync(BUNDLES_DIR, { recursive: true });

  const files = fs.readdirSync(VALUE_SETS_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.warn("No .json files in", VALUE_SETS_DIR);
    return;
  }

  for (const file of files) {
    const srcPath = path.join(VALUE_SETS_DIR, file);
    const content = fs.readFileSync(srcPath, "utf-8");

    let valueSet: fhir4.ValueSet;
    try {
      const parsed = JSON.parse(content);
      if (parsed?.resourceType !== "ValueSet") {
        console.warn("Skip (not a ValueSet):", file);
        continue;
      }
      valueSet = parsed as fhir4.ValueSet;
    } catch {
      console.warn("Skip (invalid JSON):", file);
      continue;
    }

    const id = valueSet.id ?? path.basename(file, ".json");
    const fullUrl = valueSet.url ?? `https://asu.edu/fhir/ValueSet/${id}`;
    const bundle: fhir4.Bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        {
          fullUrl,
          resource: valueSet,
          request: {
            method: "PUT",
            url: `ValueSet/${id}`,
          },
        },
      ],
    };

    const outPath = path.join(BUNDLES_DIR, file);
    fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf-8");
    console.log("Wrote", outPath);
  }
}

main();
