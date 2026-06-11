import { describe, expect, test } from "bun:test";
import {
  fmtDate,
  fmtTime,
  renderCeremony,
  renderDoc,
  renderMotions,
  sortByName,
} from "./render.ts";

// ---------------------------------------------------------------------------
// Factories — only specify what's different from default
// ---------------------------------------------------------------------------
const min = (o: any = {}) => ({
  title: "T",
  type: "minutes",
  date: "2025-09-17",
  meeting_type: "R",
  call_to_order: { time: "10:00", by: "Chair" },
  ...o,
});

const mot = (o: any = {}) => ({
  type: "Motion",
  text: "Do it.",
  by: "Chair",
  vote: { result: "Carried" },
  ...(o.vote === undefined && !("vote" in o) ? {} : { vote: o.vote }),
  ...o,
});

const carried = (o: any = {}) => ({ result: "Carried", ...o });

const enterExec = (o: any = {}) => ({
  type: "Enter Executive Session",
  by: "Chair",
  vote: carried(),
  ...o,
});

const riseExec = (o: any = {}) => ({
  type: "Rise from Executive Session",
  by: "Chair",
  vote: carried(),
  ...o,
});

// ---------------------------------------------------------------------------
// fmtTime
// ---------------------------------------------------------------------------
describe("fmtTime", () => {
  const cases: [string, string | undefined, string][] = [
    ["24h PM", "18:42", "6:42 PM"],
    ["24h AM", "7:00", "7:00 AM"],
    ["noon", "12:00", "12:00 PM"],
    ["midnight", "0:00", "12:00 AM"],
    ["12h PM", "12:00 PM", "12:00 PM"],
    ["12h AM", "12:00 AM", "12:00 AM"],
    ["1:30 PM", "1:30 PM", "1:30 PM"],
    ["11:15 AM", "11:15 AM", "11:15 AM"],
    ["trimmed", "  18:42  ", "6:42 PM"],
    ["invalid", "foo", "foo"],
  ];
  for (const [label, input, want] of cases)
    test(label, () => expect(fmtTime(input!)).toBe(want));
});

// ---------------------------------------------------------------------------
// fmtDate
// ---------------------------------------------------------------------------
describe("fmtDate", () => {
  test("ISO date", () =>
    expect(fmtDate("2025-09-17")).toBe("September 17, 2025"));
  test("ISO+TZ", () =>
    expect(fmtDate("2025-09-17T00:00:00Z")).toBe("September 17, 2025"));
  test("invalid → Invalid Date", () =>
    expect(fmtDate("not-a-date")).toBe("Invalid Date"));
});

// ---------------------------------------------------------------------------
// sortByName
// ---------------------------------------------------------------------------
describe("sortByName", () => {
  test("by last name", () =>
    expect(["Dr. Zeta", "Mr. Gamma", "Mr. Alpha"].sort(sortByName)).toEqual([
      "Mr. Alpha",
      "Mr. Gamma",
      "Dr. Zeta",
    ]));
  test("parenthetical suffix", () =>
    expect(["Mr. A. Beta (Chair)", "Mr. G. Beta"].sort(sortByName)).toEqual([
      "Mr. A. Beta (Chair)",
      "Mr. G. Beta",
    ]));
  test("single name", () =>
    expect(["Solo", "Mr. Zeta"].sort(sortByName)).toEqual([
      "Solo",
      "Mr. Zeta",
    ]));
  test("empty string", () =>
    expect(["Mr. X", ""].sort(sortByName)).toEqual(["", "Mr. X"]));
});

// ---------------------------------------------------------------------------
// renderCeremony
// ---------------------------------------------------------------------------
describe("renderCeremony", () => {
  test("by + desc", () =>
    expect(renderCeremony({ by: "Chair", description: "prayer" })).toBe(
      "Chair prayer",
    ));
  test("desc only", () =>
    expect(renderCeremony({ description: "Prayer" })).toBe("Prayer"));
  test("by only", () => expect(renderCeremony({ by: "Chair" })).toBe("Chair"));
  test("empty", () => expect(renderCeremony({})).toBe(""));
  test("empty strings", () => {
    expect(renderCeremony({ by: "", description: "" })).toBe("");
    expect(renderCeremony({ by: "Chair", description: "" })).toBe("Chair");
    expect(renderCeremony({ by: "", description: "prayer" })).toBe("prayer");
  });
});

// ---------------------------------------------------------------------------
// renderMotions
// ---------------------------------------------------------------------------
describe("renderMotions", () => {
  test("basic", () =>
    expect(renderMotions([mot()])).toBe(
      "**Motion** (Chair): Do it. **Carried** (*unanimous consent*).",
    ));

  test("final overrides text", () =>
    expect(renderMotions([mot({ text: "Old", final: "New." })])).toBe(
      "**Motion** (Chair): New. **Carried** (*unanimous consent*).",
    ));

  test("procedural — text===type", () =>
    expect(
      renderMotions([{ type: "Adjourn", by: "Chair", vote: carried() }]),
    ).toBe("**Adjourn** (Chair). **Carried** (*unanimous consent*)."));

  test("default type Motion", () =>
    expect(renderMotions([{ text: "X.", by: "Chair", vote: carried() }])).toBe(
      "**Motion** (Chair): X. **Carried** (*unanimous consent*).",
    ));

  test("trailing period added", () =>
    expect(
      renderMotions([{ type: "Motion", text: "Do the thing", by: "Chair" }]),
    ).toBe("**Motion** (Chair): Do the thing."));

  test("no by — omits parens", () =>
    expect(
      renderMotions([{ type: "Motion", text: "Do it.", vote: carried() }]),
    ).toBe("**Motion**: Do it. **Carried** (*unanimous consent*)."));

  test("already ends with period — no double period", () =>
    expect(renderMotions([mot({ text: "Fine." })])).toBe(
      "**Motion** (Chair): Fine. **Carried** (*unanimous consent*).",
    ));

  test("detailed vote counts", () =>
    expect(
      renderMotions([
        mot({
          vote: carried({ method: "show_of_hands", yes: 8, no: 2, abstain: 0 }),
        }),
      ]),
    ).toBe("**Motion** (Chair): Do it. **Carried** (*show_of_hands*, 8/2/0)."));

  test("vote member roll call", () =>
    expect(
      renderMotions([
        mot({
          vote: carried({
            method: "Roll Call",
            members: [
              { name: "Member A", vote: "Yea" },
              { name: "Member B", vote: "Nay" },
            ],
          }),
        }),
      ]),
    ).toBe("**Motion** (Chair): Do it. **Carried** (*roll call*, 1/1/0)."));

  test("seconded", () =>
    expect(renderMotions([mot({ seconded: true })])).toBe(
      "**Motion** (Chair, *seconded*): Do it. **Carried** (*unanimous consent*).",
    ));

  test("indent", () =>
    expect(renderMotions([mot()], "    ")).toBe(
      "    **Motion** (Chair): Do it. **Carried** (*unanimous consent*).",
    ));

  test("exec session suppresses inner motions", () =>
    expect(
      renderMotions([enterExec(), mot({ text: "Confidential." }), riseExec()]),
    ).toBe(
      "**Enter Executive Session** (Chair). **Carried** (*unanimous consent*).\n**Rise from Executive Session** (Chair). **Carried** (*unanimous consent*).",
    ));

  test("exec session with lifted shows motions", () =>
    expect(
      renderMotions([
        enterExec({ lifted: { date: "2026-06-01" } }),
        mot({ text: "Visible." }),
        riseExec(),
      ]),
    ).toBe(
      "**Enter Executive Session** (Chair). **Carried** (*unanimous consent*) *(Seal lifted June 1, 2026)*.\n**Motion** (Chair): Visible. **Carried** (*unanimous consent*).\n**Rise from Executive Session** (Chair). **Carried** (*unanimous consent*).",
    ));

  test("lifted with note", () =>
    expect(
      renderMotions([
        enterExec({ lifted: { date: "2026-06-01", note: "By consent" } }),
      ]),
    ).toBe(
      "**Enter Executive Session** (Chair). **Carried** (*unanimous consent*) *(Seal lifted June 1, 2026: By consent)*.",
    ));

  test("withdrawn → empty", () =>
    expect(
      renderMotions([
        mot({
          secondary: [
            { type: "Request to Withdraw a Motion", vote: carried() },
          ],
        }),
      ]),
    ).toBe(""));

  test("recordable secondary rendered", () =>
    expect(
      renderMotions([
        mot({
          secondary: [
            {
              type: "Refer",
              text: "To committee.",
              by: "Member B",
              vote: carried(),
            },
          ],
        }),
      ]),
    ).toContain("**Refer**"));

  test("amend secondary excluded", () =>
    expect(
      renderMotions([
        mot({
          secondary: [
            { type: "Amend", text: "Add X.", by: "Member B", vote: carried() },
          ],
        }),
      ]),
    ).not.toContain("Amend"));

  test("empty array", () => expect(renderMotions([])).toBe(""));

  test("vote method explicit", () =>
    expect(
      renderMotions([mot({ vote: carried({ method: "Roll Call" }) })]),
    ).toBe("**Motion** (Chair): Do it. **Carried** (*roll call*)."));

  test("vote yes/no no abstain", () =>
    expect(
      renderMotions([mot({ vote: carried({ method: "Counted Division", yes: 8, no: 2 }) })]),
    ).toBe("**Motion** (Chair): Do it. **Carried** (*counted division*, 8/2/0)."));

  test("secondary vote not Carried — excluded", () =>
    expect(
      renderMotions([
        mot({
          secondary: [
            {
              type: "Refer",
              text: "To committee.",
              by: "Member B",
              vote: { result: "Failed" },
            },
          ],
        }),
      ]),
    ).not.toContain("Refer"));

  test("multiple motions in array", () =>
    expect(
      renderMotions([mot({ text: "First." }), mot({ text: "Second." })]),
    ).toBe(
      "**Motion** (Chair): First. **Carried** (*unanimous consent*).\n**Motion** (Chair): Second. **Carried** (*unanimous consent*).",
    ));

  test("nested exec sessions — both suppressed", () =>
    expect(
      renderMotions([
        enterExec(),
        mot({ text: "C1." }),
        riseExec(),
        enterExec(),
        mot({ text: "C2." }),
        riseExec(),
      ]),
    ).not.toMatch(/C1|C2/));
});

// ---------------------------------------------------------------------------
// renderDoc
// ---------------------------------------------------------------------------
describe("renderDoc", () => {
  test("full minutes", () => {
    const r = renderDoc({
      ...min({
        call_to_order: { time: "18:42", by: "the Chair" },
        roll_call: {
          officers: [{ name: "Officer A", office: "Chair" }],
          members: ["Member B", "Member C", "Member D", "Member E"],
          members_absent: ["Member F"],
          guests: ["Guest G"],
          quorum: true,
        },
        opening_ceremonies: [
          { by: "Officer A", description: "opened with prayer." },
        ],
        reports: [{ subject: "the budget", by: "Member B" }],
        announcements: ["Fundraiser reminder."],
        closing_ceremonies: [
          { by: "Member E", description: "closed in prayer." },
        ],
        attestation: {
          secretary: "Secretary, Clerk",
          date_approved: "2025-09-17",
        },
        adjournment: {
          motion: {
            type: "Adjourn",
            text: "Meeting adjourned.",
            by: "Officer A",
            vote: carried(),
          },
        },
      }),
    });
    expect(r).toContain("# T");
    expect(r).toContain("**MINUTES**");
    expect(r).toContain("September 17, 2025");
    expect(r).toContain("**Officers:** Officer A (Chair)");
    expect(r).toContain("**Members:** Member B, Member C, Member D, Member E");
    expect(r).toContain("*(absent: Member F)*");
    expect(r).toContain("**Guests:** Guest G");
    expect(r).toContain("A quorum was present.");
    expect(r).toContain("Called to order at **6:42 PM**");
    expect(r).toContain("Officer A opened with prayer.");
    expect(r).toContain("- the budget.");
    expect(r).toContain("- Fundraiser reminder.");
    expect(r).toContain("Member E closed in prayer.");
    expect(r).toContain("**Minutes prepared by:** Secretary, Clerk");
    expect(r).toContain("**Adjourn** (Officer A): Meeting adjourned.");
  });

  test("full agenda", () => {
    const r = renderDoc({
      type: "agenda",
      title: "Committee",
      date: "2026-06-01",
      meeting_type: "R",
      scheduled_start: "18:30",
      status: "Draft",
      minutes_approval: { date: "2025-09-17" },
      opening_ceremonies: [{ description: "Prayer" }],
      reports: [{ subject: "the budget", by: "the Treasurer" }],
      unfinished_business: [{ motions: [{ text: "Ratify prior actions." }] }],
      new_business: [
        { motions: [{ text: "Adopt RONR." }, { text: "Standing rule." }] },
      ],
      closing_ceremonies: [{ description: "Prayer" }],
    });
    expect(r).toContain("**AGENDA** (*draft*)");
    expect(r).toContain("June 1, 2026");
    expect(r).toContain("Call to order at **6:30 PM**.");
    expect(r).toContain("to be approved.");
    expect(r).toContain("Ratify prior actions.");
    expect(r).toContain("Adopt RONR.");
    expect(r).toContain("Standing rule.");
  });

  test("no roll_call sections", () => {
    const r = renderDoc(min());
    expect(r).not.toMatch(/Officers:|Members:|A quorum/);
  });

  test("no quorum", () => {
    const r = renderDoc(min({ roll_call: { quorum: false } }));
    expect(r).toContain("A quorum was not present.");
  });

  test("no attestation", () => {
    const r = renderDoc(min());
    expect(r).not.toContain("Minutes prepared by");
  });

  test("no status parens", () => {
    const r = renderDoc({
      type: "agenda",
      title: "T",
      date: "2025-01-01",
      meeting_type: "R",
      scheduled_start: "10:00",
    });
    expect(r).toContain("**AGENDA**");
    expect(r).not.toContain("(*)");
  });

  test("awaiting approval", () => {
    const r = renderDoc(min({ attestation: { secretary: "S" } }));
    expect(r).toContain("*(awaiting approval)*");
  });

  test("minutes approval with corrections and motion", () => {
    const r = renderDoc(
      min({
        minutes_approval: {
          date: "2024-12-01",
          result: "Approved as Corrected",
          corrections: "p.3",
          motion: { by: "Chair", seconded: true },
        },
      }),
    );
    expect(r).toContain("were **Approved as Corrected**.");
    expect(r).toContain("Corrections: p.3.");
    expect(r).toContain("Motion by Chair, *seconded*.");
  });

  test("minutes approval motion without seconded", () =>
    expect(
      renderDoc(
        min({
          minutes_approval: {
            date: "2024-12-01",
            result: "Approved",
            motion: { by: "Officer A" },
          },
        }),
      ),
    ).toContain("Motion by Officer A."));

  test("recess before adjournment", () => {
    const r = renderDoc(
      min({
        recess: {
          motion: { type: "Take a Recess", by: "Chair", vote: carried() },
        },
        adjournment: {
          motion: { type: "Adjourn", by: "Chair", vote: carried() },
        },
      }),
    );
    expect(r.indexOf("Take a Recess")).toBeLessThan(r.indexOf("Adjourn"));
  });

  test("recess only, no adjournment", () =>
    expect(
      renderDoc(
        min({
          recess: {
            motion: { type: "Take a Recess", by: "Chair", vote: carried() },
          },
        }),
      ),
    ).toContain("**Take a Recess**"));

  test("multiple ceremonies listed", () => {
    const r = renderDoc(
      min({
        closing_ceremonies: [
          { by: "Person A", description: "prayer" },
          { by: "Person B", description: "song" },
        ],
      }),
    );
    expect(r).toContain("- Person A prayer");
    expect(r).toContain("- Person B song");
  });

  test("single ceremony — no bullet prefix", () =>
    expect(
      renderDoc(
        min({ opening_ceremonies: [{ by: "Chair", description: "prayer" }] }),
      ),
    ).toContain("Chair prayer"));

  test("report subject missing — fallback text", () =>
    expect(renderDoc(min({ reports: [{ by: "Chair" }] }))).toContain(
      "- (missing subject).",
    ));

  test("empty secretary string", () =>
    expect(renderDoc(min({ attestation: { secretary: "" } }))).toContain(
      "**Minutes prepared by:** ",
    ));

  test("guests without officers or members", () =>
    expect(
      renderDoc(min({ roll_call: { guests: ["Guest X"], quorum: true } })),
    ).toContain("**Guests:** Guest X"));

  // -----------------------------------------------------------------------
  // Business items — all four shapes, identical for unfinished + new
  // -----------------------------------------------------------------------
  const bizItem: [string, any, string][] = [
    ["title+desc", { title: "X", description: "Y" }, "- **X**: Y"],
    ["desc only", { description: "Y" }, "- Y"],
    ["title only", { title: "X" }, "- **X**"],
    [
      "motions only",
      { motions: [mot({ text: "M." })] },
      "**Motion** (Chair): M.",
    ],
  ];

  for (const [label, item, want] of bizItem) {
    test(`unfinished business ${label}`, () =>
      expect(renderDoc(min({ unfinished_business: [item] }))).toContain(want));
    test(`new business ${label}`, () =>
      expect(renderDoc(min({ new_business: [item] }))).toContain(want));
    test(`special orders ${label}`, () =>
      expect(renderDoc(min({ special_orders: [item] }))).toContain(want));
  }

  test("section ordering: reports → special_orders → unfinished → new", () => {
    const r = renderDoc(
      min({
        reports: [{ subject: "R", by: "A" }],
        special_orders: [{ description: "SO" }],
        unfinished_business: [{ description: "UB" }],
        new_business: [{ description: "NB" }],
      }),
    );
    expect(r.indexOf("Reports")).toBeLessThan(r.indexOf("Special Orders"));
    expect(r.indexOf("Special Orders")).toBeLessThan(
      r.indexOf("Unfinished Business"),
    );
    expect(r.indexOf("Unfinished Business")).toBeLessThan(
      r.indexOf("New Business"),
    );
  });
});
