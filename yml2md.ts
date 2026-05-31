const { parse } = await import("yaml");
const file = process.argv[2];
if (!file) {
  console.error("Usage: bun yml2md.ts <file>");
  process.exit(1);
}

const raw = await Bun.file(file).text();
const m = parse(raw);

const isAgenda = !!m.scheduled_start;

let out = "";

const md = (s: string) => {
  out += s + "\n\n";
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

const fmtDate = (s: string) => {
  const parts = s.split("T")[0]!.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );
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
  if (m.roll_call.officers_present?.length) {
    md(
      `**Officers Present:** ${m.roll_call.officers_present.map((o: any) => `${o.name} (${o.office})`).join(", ")}`,
    );
  }
  if (m.roll_call.members_present?.length) {
    md(`**Members Present:** ${m.roll_call.members_present.join(", ")}`);
  }
  if (m.roll_call.members_absent?.length) {
    md(`**Members Absent:** ${m.roll_call.members_absent.join(", ")}`);
  }
  if (m.roll_call.guests?.length) {
    md(`**Guests:** ${m.roll_call.guests.join(", ")}`);
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
    let block = `- ${r.by} presented the report on ${r.title}.`;
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
      const rendered = m.closing_ceremonies.map(renderCeremony).filter(Boolean);
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
  md(
    `---\n\n**Attested by:** ${m.attestation.secretary}\n\n**Date Approved:** ${fmtDate(m.attestation.date_approved)}`,
  );
}

const mdFile = file.replace(/\.yml$/, ".md");
await Bun.write(mdFile, out);
const scriptDir = import.meta.dirname;
Bun.spawnSync(["bash", scriptDir + "/md2pdf.sh", mdFile]);

function renderMotions(motions: any[], indent = ""): string {
  return motions
    .map((mot) => {
      let header = `**${mot.type || "Main Motion"}**`;
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

      if (mot.disposition) {
        line += ` ${mot.disposition}`;
        if (mot.referred_to) line += ` (referred to ${mot.referred_to})`;
        if (mot.postponed_to)
          line += ` (postponed to ${fmtDate(mot.postponed_to)})`;
        if (mot.corrections?.length) line += `: ${mot.corrections.join(", ")}`;
      }

      if (!line.endsWith(".")) line += ".";

      const recordableTypes = new Set(["Commit", "Refer", "Limit or Extend Debate", "Previous Question", "Take a Recess", "Adjourn", "Lay on the Table"]);
      const recordable = mot.secondary?.filter((s: any) => recordableTypes.has(s.type));
      if (recordable?.length) {
        line += `\n\n${renderMotions(recordable, indent)}`;
      }
      return indent + line;
    })
    .join("\n");
}
