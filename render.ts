#!/usr/bin/env bun
import path from "node:path";
import { renderDoc } from "./lib/render.ts";
import { watch } from "node:fs";
const { parse } = await import("yaml");
const Ajv = (await import("ajv")).default;
const addFormats = (await import("ajv-formats")).default;

const args = process.argv.slice(2);
const watchMode = args.includes("--watch") || args.includes("-w");
const fileArgs = args.filter((a) => a !== "--watch" && a !== "-w");

if (!fileArgs.length) {
  console.error(
    `Usage: bun render.ts [--watch] <file|glob>...\n\n` +
      `  --watch  Re-render files on change`,
  );
  process.exit(1);
}

const files = fileArgs.flatMap((arg) =>
  /[*?[]/.test(arg) ? [...new Bun.Glob(arg).scanSync()] : [arg],
);

const scriptDir = import.meta.dirname;
const yml = (s: string) => Bun.file(scriptDir + s).text();

// Load and compile JSON Schemas for validation
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

const md2pdf = (mdFile: string, pdfFile?: string) => {
  const pdf = pdfFile || mdFile.replace(/\.md$/, ".pdf");
  const result = Bun.spawnSync([
    "bash", scriptDir + "/scripts/md2pdf.sh", mdFile, pdf,
  ]);
  if (result.exitCode === 0) console.log(`  → ${pdf}`);
};

async function processFile(file: string) {
  if (file.endsWith(".md")) {
    console.log(`  ${file}`);
    md2pdf(file);
    return;
  }

  if (!file.endsWith(".yml")) return;

  console.log(`  ${file}`);
  let raw;
  try {
    raw = await Bun.file(file).text();
  } catch (e) {
    console.error(`  ✗ ${file}: ${e}`);
    return;
  }
  const m = parse(raw);

  const isAgenda = m.type === "agenda";
  const validate = isAgenda ? validateAgenda : validateMinutes;
  const valid = validate(m);
  if (!valid) {
    console.error(`  ⚠ Validation errors:`);
    for (const err of validate.errors ?? []) {
      console.error(`    - ${err.instancePath || "/"}: ${err.message}`);
    }
  }

  const mdFile = file.replace(/\.yml$/, ".md");
  const friendly = `${m.date} ${m.title} ${isAgenda ? "Agenda" : "Minutes"}.pdf`;
  const pdfFile = path.join(path.dirname(file), friendly);
  await Bun.write(mdFile, renderDoc(m));
  console.log(`  → ${mdFile}`);
  md2pdf(mdFile, pdfFile);
}

for (const file of files) {
  await processFile(file);
}

if (watchMode) {
  const watchedDirs = new Set<string>();
  const fileSet = new Set(files.map((f) => path.resolve(f)));

  for (const file of files) {
    const dir = path.dirname(path.resolve(file));
    if (watchedDirs.has(dir)) continue;
    watchedDirs.add(dir);
    watch(dir, (event, filename) => {
      if (!filename) return;
      const full = path.resolve(dir, filename);
      if (fileSet.has(full)) {
        console.log(`\n[change] ${filename}`);
        processFile(full);
      }
    });
  }

  console.log(`\nWatching ${files.length} file(s) for changes...`);
  await new Promise(() => {});
}
