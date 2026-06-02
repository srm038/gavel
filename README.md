# ronr-minutes — Minutes as Code

Author meeting minutes and agendas in YAML, validate against JSON Schema, render to Markdown + PDF in one command.

```
.yml ─────── render.ts ───────→  .md + .pdf
```

No intermediate steps — `bun render.ts <file|glob>` produces both files.

## Philosophy: Minutes as Code

- **YAML as source of truth** — minutes are structured data, not prose
- **JSON Schema validation** — catch structural errors on save (Helix, VS Code)
- **Single renderer** — auto-detects agenda vs. minutes by `m.scheduled_start`
- **Dual schema, shared definitions** — `common.schema.yml` ground shared fields, agenda/minutes schemas extend via `allOf`
- **Repeatable output** — same YAML always produces same Markdown + PDF

## Document Types

| Type     | Schema              | Sample               | Detection              |
|----------|---------------------|----------------------|------------------------|
| Agenda   | `agenda.schema.yml` | `sample.agenda.yml`  | `m.scheduled_start`    |
| Minutes  | `minutes.schema.yml`| `sample.minutes.yml` | `m.call_to_order`      |

## Usage

```bash
bun render.ts sample.minutes.yml
bun render.ts sample.agenda.yml
bun render.ts sample.*.yml           # glob — processes all matching files
```

Each file produces `.md` and `.pdf` with the same base name.

## Editor Setup

`.helix/languages.toml` and `.vscode/settings.json` map `*.minutes.yml` → `minutes.schema.yml`, `*.agenda.yml` → `agenda.schema.yml` for yaml-language-server validation on save.

## Conventions

- **Motion types** — Omit `type` → renders as "Motion". Explicit types (Adjourn, Commit, Refer, etc.) render as labeled.
- **`final`** — If present, replaces `text` in rendered output (captures amended wording).
- **`secondary`** — Array of motions applied while main motion was pending. Recordable types rendered: Commit, Refer, Limit or Extend Debate, Previous Question, Take a Recess, Adjourn, Lay on the Table.
- **`subject`** — Reports use `subject` (not `title`) to avoid confusion with business item titles.
- **Roll call** — Officers, Members, Guests alphabetically by last name. Absent members inline as `*(absent: ...)*`.
- **Minutes approval** — Agenda: "to be approved". Minutes: "were **Approved**".
- **Date formatting** — YYYY-MM-DD → "September 17, 2025".
- **Time formatting** — 24h or 12h input → "6:30 PM".

## Required vs Optional

| Field | Agenda | Minutes |
|-------|--------|---------|
| `scheduled_start` | required | absent |
| `call_to_order` | absent | required |
| `roll_call` | absent | optional |
| `adjournment` | optional | at least one |
| `recess` | absent | at least one |
| `attestation` | absent | optional |

## Requirements

- [Bun](https://bun.sh) — runtime
- [Pandoc](https://pandoc.org) — PDF conversion
- XeLaTeX — PDF engine
- Times New Roman font (or substitute via `md2pdf.sh`)
- yaml-language-server (optional, for editor validation)

```bash
brew bundle
./install-tex.sh
```

## Future Improvements

### Schema

- **Document type discriminator** — Replace `scheduled_start` heuristic with explicit `type: [agenda, minutes]` field in `meeting_metadata`
- **Election schema** — Support multiple ballots, runoffs, write-ins, preferential voting, abstentions per candidate, motion-to-close-nominations
- **Executive session model** — Mark portions as executive session, separate attendance, sealing mechanism
- **Report type enum** — Resolve ambiguity between "Special", "Ad Hoc Committee", "Standing Committee" — flatten or clarify
- **Additional RONR motion types** — Add "Object to Consideration", "Parliamentary Inquiry", "Request for Information", "Division of the Question" to motion type enum
- **Conditional `final` field** — Require `final` when disposition=Adopted; conditional validation

### Pipeline

- **Tests** — Snapshot tests for Markdown output, schema validation tests
- **Better CLI** — `--help`, `--strict` (fail on validation), `--output-dir`, `--format md|pdf|both|html`, `--watch`
- **Agenda→minutes promotion** — Tool to diff, merge, or promote agenda YAML to minutes skeleton after meeting
- **Parallel processing** — Use `Promise.all()` for batch rendering multiple files

## Schemas

- `common.schema.yml` — Shared definitions: `meeting_metadata`, `ceremony`, `motion`, `minutes_approval`, `election`
- `agenda.schema.yml` — Pre-meeting fields (`scheduled_start`); no vote/disposition
- `minutes.schema.yml` — Recording fields (`call_to_order`, `roll_call`, `attestation`); extends motions with `vote`, `disposition`, `final`, `secondary`; requires `adjournment` or `recess`
