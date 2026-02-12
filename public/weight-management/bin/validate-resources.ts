/**
 * Runs the FHIR Resource $validate operation (https://hl7.org/fhir/R4/resource-operation-validate.html)
 * for each ValueSet in fhir/ using VALIDATE_URL (local validator) to report structural/field errors.
 *
 * Run: npx ts-node bin/validate-resources.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const OUTPUT_DIR = path.join(ROOT, "fhir");
const VALIDATE_URL = "http://localhost:8282/fhir/ValueSet/$validate";

interface ValidateResult {
  httpCode: number;
  outcome?: fhir4.OperationOutcome;
  error?: string;
}

async function validateValueSet(body: string): Promise<ValidateResult> {
  const res = await fetch(VALIDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
    body,
  });
  const text = await res.text();
  let outcome: ValidateResult["outcome"];
  try {
    outcome = JSON.parse(text) as ValidateResult["outcome"];
  } catch {
    outcome = undefined;
  }
  return {
    httpCode: res.status,
    outcome,
    error: res.ok ? undefined : text.slice(0, 200),
  };
}

async function main(): Promise<void> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error("Directory not found:", OUTPUT_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.warn("No .json files in", OUTPUT_DIR);
    return;
  }

  console.log("--- FHIR Resource $validate (ValueSet) ---");
  for (const file of files) {
    const jsonPath = path.join(OUTPUT_DIR, file);
    const body = fs.readFileSync(jsonPath, "utf-8");
    const result = await validateValueSet(body);
    const name = path.basename(file, ".json");
    if (result.httpCode !== 200) {
      console.log(`${name}: HTTP ${result.httpCode}`);
      if (result.error) console.log("  ", result.error);
    }
    const issues =
      result.outcome?.issue?.filter((i) => i.severity === "error" || i.severity === "warning") ?? [];
    if (issues.length > 0) {
      console.log(`${name}: ${issues.length} issue(s)`);
      for (const i of issues) {
        const msg = i.details?.text ?? i.code ?? "unknown";
        const loc = i.location?.join(", ") ?? "";
        console.log(`  [${i.severity}] ${i.code ?? ""}: ${msg}${loc ? `\n      location: ${loc}` : ""}`);
        if (i.diagnostics) console.log(`      diagnostics: ${i.diagnostics}`);
        if (i.expression?.length) console.log(`      expression: ${i.expression.join(", ")}`);
      }
    } else if (result.httpCode === 200 && result.outcome) {
      const allOk = result.outcome.issue?.every(
        (i) => i.severity === "information" || i.details?.text?.includes("OK")
      );
      console.log(`${name}: ${allOk ? "OK" : "see outcome"}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
