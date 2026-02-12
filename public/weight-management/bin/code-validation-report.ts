/**
 * Uses the CodeSystem/$validate-code operation (tx.fhir.org) to validate each code
 * from the ValueSets in fhir/ and writes a CSV report: File, CodeSystem ID, Code, Result, JSON Response.
 *
 * Run: npx ts-node bin/code-validation-report.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const INPUT_DIR = path.join(ROOT, "fhir");
const REPORT_PATH = path.join(ROOT, "fhir", "code-validation-report.csv");
const VALIDATE_CODE_URL = "http://localhost:8282/fhir/CodeSystem/$validate-code";

/** Delay between API calls (ms) to reduce load on the server */
const REQUEST_DELAY_MS = 100;

function escapeCsvField(value: string): string {
  const quoted = value.replace(/"/g, '""');
  return `"${quoted}"`;
}

async function validateCode(
  system: string,
  code: string,
  display?: string,
  version?: string
): Promise<{ result: "valid" | "invalid" | "error"; message?: string; responseJson: string }> {
  const params: fhir4.Parameters = {
    resourceType: "Parameters",
    parameter: [
      { name: "url", valueUri: system },
      { name: "code", valueCode: code },
      ...(display != null && display !== "" ? [{ name: "display", valueString: display }] : []),
      ...(version != null && version !== "" ? [{ name: "version", valueString: version }] : []),
    ],
  };

  let res: Response;
  let text: string;
  try {
    res = await fetch(VALIDATE_CODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
      body: JSON.stringify(params),
    });
    text = await res.text();
  } catch (e) {
    return { result: "error", message: String(e), responseJson: JSON.stringify({ error: String(e) }) };
  }

  let result: "valid" | "invalid" | "error" = "error";
  let message: string | undefined;
  try {
    const json = JSON.parse(text) as fhir4.Parameters;
    if (json.resourceType === "Parameters" && Array.isArray(json.parameter)) {
      const resultParam = json.parameter.find((p: fhir4.ParametersParameter) => p.name === "result");
      if (resultParam && typeof resultParam.valueBoolean === "boolean") {
        result = resultParam.valueBoolean ? "valid" : "invalid";
      }
      const msgParam = json.parameter.find((p: fhir4.ParametersParameter) => p.name === "message");
      if (msgParam && typeof msgParam.valueString === "string") message = msgParam.valueString;
    }
  } catch {
    // leave result as "error"
  }
  return { result, message, responseJson: text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error("Directory not found:", INPUT_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.warn("No .json files in", INPUT_DIR);
    return;
  }

  const rows: string[][] = [["File", "CodeSystem ID", "Code", "Result", "JSON Response"]];
  let totalCodes = 0;
  let validCount = 0;
  let invalidCount = 0;
  let errorCount = 0;
  const invalidEntries: { file: string; system: string; code: string; result: string; message?: string }[] = [];

  console.log("--- Code validation (tx.fhir.org CodeSystem/$validate-code) ---\n");

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    let vs: fhir4.ValueSet;
    try {
      vs = JSON.parse(content) as fhir4.ValueSet;
    } catch {
      console.warn("Skip (invalid JSON):", file);
      continue;
    }

    const includes = vs.compose?.include ?? [];
    for (const inc of includes) {
      const system = inc.system ?? "";
      const version = inc.version;
      const concepts = inc.concept ?? [];
      for (const c of concepts) {
        const code = c.code ?? "";
        const display = c.display;
        totalCodes++;
        const { result, message, responseJson } = await validateCode(system, code, display, version);
        rows.push([
          file,
          system,
          code,
          result,
          responseJson.replace(/\r?\n/g, " "),
        ]);

        if (result === "valid") validCount++;
        else if (result === "invalid") {
          invalidCount++;
          invalidEntries.push({ file, system, code, result, message });
        } else {
          errorCount++;
          invalidEntries.push({ file, system, code, result, message });
        }

        const resultLabel = result === "valid" ? "valid " : result.toUpperCase();
        const msgSuffix = message ? `  → ${message}` : "";
        console.log(`  [${resultLabel}]  ${file}  ${code}  (${system})${msgSuffix}`);

        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  const csvContent = rows
    .map((cells) => cells.map(escapeCsvField).join(","))
    .join("\n");

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, csvContent, "utf-8");

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Total:   ${totalCodes}`);
  console.log(`  Valid:   ${validCount}`);
  console.log(`  Invalid: ${invalidCount}`);
  console.log(`  Error:   ${errorCount}`);
  console.log(`\nReport: ${REPORT_PATH}`);

  if (invalidEntries.length > 0) {
    console.log("\n" + "!".repeat(60));
    console.log("INVALID / ERROR CODES (require attention)");
    console.log("!".repeat(60));
    for (const e of invalidEntries) {
      console.log(`  [${e.result.toUpperCase()}] ${e.file}  |  ${e.code}  |  ${e.system}`);
      if (e.message) console.log(`      ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
