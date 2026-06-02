export const renderCeremony = (c: any) =>
  [c.by, c.description].filter(Boolean).join(" ");

export const fmtTime = (s: string) => {
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

export const sortByName = (a: string, b: string) => {
  const last = (s: string) =>
    s
      .replace(/\(.*\)/, "")
      .trim()
      .split(/\s+/)
      .pop() ?? "";
  return last(a).localeCompare(last(b));
};

export const fmtDate = (s: string) => {
  const parts = s.split("T")[0]!.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );
};

export function renderDoc(m: any): string {
  const isAgenda = m.type === "agenda";
  let out = "";
  const md = (s: string) => { out += s + "\n\n"; };

  md(`# ${m.title}`);
  if (isAgenda) {
    md(`**AGENDA**${m.status ? ` (*${m.status.toLowerCase()}*)` : ""}`);
  } else {
    md(`**MINUTES**${m.status ? ` (*${m.status.toLowerCase()}*)` : ""}`);
  }
  md(`**Date:** ${fmtDate(m.date)} (${m.meeting_type})`);

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

  if (m.special_orders?.length) {
    md(`## Special Orders`);
    for (const item of m.special_orders) {
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

  if (m.announcements?.length) {
    md(`## Announcements`);
    for (const a of m.announcements) md(`- ${a}`);
  }

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

  if (m.attestation) {
    let line = `\n---\n**Minutes prepared by:** ${m.attestation.secretary}`;
    line += m.attestation.date_approved
      ? ` *(approved: ${fmtDate(m.attestation.date_approved)})*`
      : " *(awaiting approval)*";
    md(line);
  }

  return out;
}

export function renderMotions(motions: any[], indent = ""): string {
  let inExec = false;
  return motions
    .map((mot) => {
      if (mot.type === "Enter Executive Session") inExec = !mot.lifted;
      else if (mot.type === "Rise from Executive Session") inExec = false;
      else if (inExec) return null;

      let header = `**${mot.type || "Motion"}**`;
      if (mot.by) {
        header += ` (${mot.by}`;
        if (mot.seconded) header += `, *seconded*`;
        header += ")";
      }

      let text = mot.final || mot.text || mot.type;
      let line;
      if (text === mot.type) {
        line = `${header}.`;
      } else {
        if (!text.endsWith(".")) text += ".";
        line = `${header}: ${text}`;
      }

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

      if (mot.lifted) {
        const d = fmtDate(mot.lifted.date);
        line += ` *(Seal lifted ${d}${mot.lifted.note ? `: ${mot.lifted.note}` : ""})*`;
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
