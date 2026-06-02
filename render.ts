#!/usr/bin/env bun
import path from "path";
const { parse } = await import("yaml");
const Ajv = (await import("ajv")).default;
const addFormats = (await import("ajv-formats")).default;

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: bun render.ts <file|glob>...");
  process.exit(1);
}

const files = args.flatMap((arg) =>
  /[*?[]/.test(arg) ? [...new Bun.Glob(arg).scanSync()] : [arg],
).filter((f) => f.endsWith(".yml"));

const getGitSha = async (fp: string) => {
  const dir = path.dirname(fp) || ".";
  const base = path.basename(fp);
  const gitDir = await Bun.$`git -C ${dir} rev-parse --show-toplevel`
    .text()
    .catch(() => "");
  if (!gitDir.trim()) return null;
  const rel = await Bun.$`git -C ${dir} ls-files ${base}`
    .text()
    .catch(() => "");
  if (!rel.trim()) return null;
  const { stdout } = Bun.spawnSync([
    "git",
    "-C",
    dir,
    "log",
    "-1",
    "--format=%h",
    "--",
    rel.trim(),
  ]);
  return stdout.toString().trim() || null;
};

const renderCeremony = (c: any) =>
  [c.by, c.description].filter(Boolean).join(" ");

const fmtTime = (s: string) => {
  s = s.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return s;
  let h = Number(m[1]!);
  const min = m[2]!;
  if (m[3]) {
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
  }
  const h12 = h % 12 || 12;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h12}:${min} ${suffix}`;
};

const sortByName = (a: string, b: string) => {
  const last = (s: string) =>
    s
      .replace(/\(.*\)/, "")
      .trim()
      .split(/\s+/)
      .pop() ?? "";
  return last(a).localeCompare(last(b));
};

const fmtDate = (s: string) => {
  const parts = s.split("T")[0]!.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );
};

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

  let out = "";

  const md = (s: string) => {
    out += s + "\n\n";
  };

  // Header
  md(`# ${m.title}`);
  if (isAgenda) {
    md(`**AGENDA**${m.status ? ` (*${m.status.toLowerCase()}*)` : ""}`);
  } else {
    md(`**MINUTES**${m.status ? ` (*${m.status.toLowerCase()}*)` : ""}`);
  }
  md(`**Date:** ${fmtDate(m.date)} (${m.meeting_type})`);

  // Roll Call
  if (m.roll_call) {
    if (m.roll_call.officers?.length) {
      const sorted = [...m.roll_call.officers].sort((a: any, b: any) =>
        sortByName(a.name, b.name),
      );
      md(
        `**Officers:** ${sorted.map((o: any) => `${o.name} (${o.office})`).join(", ")}`,
      );
    }
    if (m.roll_call.members?.length) {
      const sorted = [...m.roll_call.members].sort(sortByName);
      let line = `**Members:** ${sorted.join(", ")}`;
      if (m.roll_call.members_absent?.length) {
        const absent = [...m.roll_call.members_absent].sort(sortByName);
        line += ` *(absent: ${absent.join(", ")})*`;
      }
      md(line);
    }
    if (m.roll_call.guests?.length) {
      const sorted = [...m.roll_call.guests].sort(sortByName);
      md(`**Guests:** ${sorted.join(", ")}`);
    }
    md(`A quorum was ${m.roll_call.quorum ? "" : "not "}present.`);
  }

  // Opening
  if (isAgenda) {
    let block = `Call to order at **${fmtTime(m.scheduled_start)}**.`;
    if (m.opening_ceremonies?.length) {
      const rendered = m.opening_ceremonies.map(renderCeremony).filter(Boolean);
      if (rendered.length) block += `\n`;
      for (const r of rendered) {
        block += `\n${rendered.length > 1 ? "- " : ""}${r}`;
      }
    }
    md(block);
  } else {
    let block = `Called to order at **${fmtTime(m.call_to_order.time)}** by ${m.call_to_order.by}.`;
    if (m.opening_ceremonies?.length) {
      const rendered = m.opening_ceremonies.map(renderCeremony).filter(Boolean);
      if (rendered.length) block += `\n`;
      for (const r of rendered) {
        block += `\n${rendered.length > 1 ? "- " : ""}${r}`;
      }
    }
    md(block);
  }

  // Minutes Approval
  if (m.minutes_approval) {
    const a = m.minutes_approval;
    let line = `Minutes of **${fmtDate(a.date)}**`;
    if (isAgenda) {
      line += ` to be approved.`;
    } else {
      line += ` were **${a.result}**.`;
    }
    if (a.corrections) line += ` Corrections: ${a.corrections}.`;
    if (a.motion) {
      line += ` Motion by ${a.motion.by}${a.motion.seconded ? ", *seconded*" : ""}.`;
    }
    md(line);
  }

  // Reports
  if (m.reports?.length) {
    md(`## Reports`);
    for (const r of m.reports) {
      let subj = r.subject ?? "(missing subject)";
      if (!subj.endsWith(".")) subj += ".";
      let block = `- ${r.by} presented ${subj}`;
      if (r.motions?.length) block += `\n\n${renderMotions(r.motions, "    ")}`;
      md(block);
    }
  }

  // Unfinished Business
  if (m.unfinished_business?.length) {
    md(`## Unfinished Business`);
    for (const item of m.unfinished_business) {
      let block = "";
      if (item.title && item.description) {
        block = `- **${item.title}**: ${item.description}`;
        if (item.motions?.length)
          block += `\n\n${renderMotions(item.motions, "    ")}`;
      } else if (item.description) {
        block = `- ${item.description}`;
        if (item.motions?.length)
          block += `\n\n${renderMotions(item.motions, "    ")}`;
      } else if (item.title) {
        block = `- **${item.title}**`;
        if (item.motions?.length)
          block += `\n\n${renderMotions(item.motions, "    ")}`;
      } else if (item.motions?.length) {
        block = renderMotions(item.motions, "- ");
      }
      md(block);
    }
  }

  // New Business
  if (m.new_business?.length) {
    md(`## New Business`);
    for (const item of m.new_business) {
      let block = "";
      if (item.title && item.description) {
        block = `- **${item.title}**: ${item.description}`;
        if (item.motions?.length)
          block += `\n\n${renderMotions(item.motions, "    ")}`;
      } else if (item.description) {
        block = `- ${item.description}`;
        if (item.motions?.length)
          block += `\n\n${renderMotions(item.motions, "    ")}`;
      } else if (item.title) {
        block = `- **${item.title}**`;
        if (item.motions?.length)
          block += `\n\n${renderMotions(item.motions, "    ")}`;
      } else if (item.motions?.length) {
        block = renderMotions(item.motions, "- ");
      }
      md(block);
    }
  }

  // Announcements
  if (m.announcements?.length) {
    md(`## Announcements`);
    for (const a of m.announcements) md(`- ${a}`);
  }

  // Recess & Adjournment & Closing Ceremonies
  {
    const hasRecess = !!m.recess?.motion;
    const hasAdj = !!m.adjournment?.motion;
    const hasCeremonies = m.closing_ceremonies?.length;
    const motions = [];
    if (hasRecess) motions.push(m.recess.motion);
    if (hasAdj) motions.push(m.adjournment.motion);
    if (motions.length || hasCeremonies) {
      let block = "";
      if (motions.length) block += renderMotions(motions);
      if (hasCeremonies) {
        const rendered = m.closing_ceremonies
          .map(renderCeremony)
          .filter(Boolean);
        if (rendered.length) {
          if (block) block += `\n`;
          for (const r of rendered) {
            block += `\n${rendered.length > 1 ? "- " : ""}${r}`;
          }
        }
      }
      md(block);
    }
  }

  // Attestation
  if (m.attestation) {
    md(`\nMinutes prepared by: ${m.attestation.secretary}`);
    if (m.attestation.date_approved)
      md(`Approved by the committee on: ${fmtDate(m.attestation.date_approved)}`);
  }

  const sha = await getGitSha(file);

  const mdFile = file.replace(/\.yml$/, ".md");
  await Bun.write(mdFile, out);
  const scriptDir = import.meta.dirname;
  const result = Bun.spawnSync([
    "bash",
    scriptDir + "/scripts/md2pdf.sh",
    mdFile,
    sha ?? "",
  ]);
  console.log(`  → ${mdFile}`);
  if (result.exitCode === 0)
    console.log(`  → ${mdFile.replace(/\.md$/, ".pdf")}`);
}

function renderMotions(motions: any[], indent = ""): string {
  return motions
    .map((mot) => {
      let header = `**${mot.type || "Motion"}**`;
      if (mot.by) {
        header += ` (${mot.by}`;
        if (mot.seconded) header += `, *seconded*`;
        header += ")";
      }

      let text = mot.final || mot.text;
      if (!text.endsWith(".")) text += ".";

      let line = `${header}: ${text}`;

      if (mot.vote) {
        let method = mot.vote.method?.toLowerCase() || "voice";
        line += ` **${mot.vote.result}** (*${method}*`;
        if (
          mot.vote.yes !== undefined ||
          mot.vote.no !== undefined ||
          mot.vote.abstain !== undefined
        ) {
          line += `, ${mot.vote.yes ?? 0} yes / ${mot.vote.no ?? 0} no / ${mot.vote.abstain ?? 0} abstain`;
        }
        if (mot.vote.members?.length)
          line += `: ${mot.vote.members.map((mem: any) => `${mem.name}: ${mem.vote}`).join(", ")}`;
        line += ")";
      }

      if (!line.endsWith(".")) line += ".";

      const withdrawn = mot.secondary?.some(
        (s: any) =>
          s.type === "Request to Withdraw a Motion" &&
          s.vote?.result === "Carried",
      );
      if (withdrawn) return null;

      const recordable = mot.secondary?.filter(
        (s: any) => s.vote?.result === "Carried" && s.type !== "Amend",
      );
      if (recordable?.length) {
        line += `\n\n${renderMotions(recordable, indent)}`;
      }
      return indent + line;
    })
    .filter(Boolean)
    .join("\n");
}
