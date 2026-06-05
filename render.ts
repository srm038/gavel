#!/usr/bin/env bun
import { renderDoc } from "./lib/render.ts";
const { parse } = await import("yaml");
const Ajv = (await import("ajv")).default;
const addFormats = (await import("ajv-formats")).default;

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: bun render.ts <file|glob>...");
  process.exit(1);
}

const files = args
  .flatMap((arg) =>
    /[*?[]/.test(arg) ? [...new Bun.Glob(arg).scanSync()] : [arg],
  )
  .filter((f) => f.endsWith(".yml"));

// Load and compile JSON Schemas for validation
const scriptDir = import.meta.dirname;
const yml = (s: string) => Bun.file(scriptDir + s).text();
const [common, agenda, mins] = await Promise.all([
  yml("/schemas/common.schema.yml"),
  yml("/schemas/agenda.schema.yml"),
  yml("/schemas/minutes.schema.yml"),
]);
const commonSchema = parse(common);
const agendaSchema = parse(agenda);
const minutesSchema = parse(mins);

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(commonSchema);
const validateAgenda = ajv.compile(agendaSchema);
const validateMinutes = ajv.compile(minutesSchema);

for (const file of files) {
  console.log(`  ${file}`);
  let raw;
  try {
    raw = await Bun.file(file).text();
  } catch (e) {
    console.error(`  ✗ ${file}: ${e}`);
    continue;
  }
  const m = parse(raw);

  const isAgenda = m.type === "agenda";

  // Validate against schema
  const validate = isAgenda ? validateAgenda : validateMinutes;
  const valid = validate(m);
  if (!valid) {
    console.error(`  ⚠ Validation errors:`);
    for (const err of validate.errors ?? []) {
      console.error(`    - ${err.instancePath || "/"}: ${err.message}`);
    }
  }

  const out = renderDoc(m);

  const mdFile = file.replace(/\.yml$/, ".md");
  await Bun.write(mdFile, out);
  const scriptDir = import.meta.dirname;
  const result = Bun.spawnSync([
    "bash",
    scriptDir + "/scripts/md2pdf.sh",
    mdFile,
  ]);
  console.log(`  → ${mdFile}`);
  if (result.exitCode === 0)
    console.log(`  → ${mdFile.replace(/\.md$/, ".pdf")}`);
}
