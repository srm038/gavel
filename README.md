# ronr-minutes

Author meeting minutes and agendas in YAML, validate against JSON Schema, render to Markdown + PDF. Dual-schema toolchain with shared definitions where possible; single renderer auto-detects document type.

## Pipeline

```
.yml ──────────────────→  .md + .pdf
(editor)                  (yml2md.ts — calls md2pdf.sh internally)
```

No intermediate steps needed — `bun yml2md.ts` produces both files in one command.

## Document Types

Two document schemas sharing definitions via `common.schema.yml`:

| Type     | Schema              | Sample               | Detection              |
|----------|---------------------|----------------------|------------------------|
| Agenda   | `agenda.schema.yml` | `sample.agenda.yml`  | `m.scheduled_start`    |
| Minutes  | `minutes.schema.yml`| `sample.minutes.yml` | `m.call_to_order`      |

Agenda omits recording fields (`roll_call`, `call_to_order`, `attestation`, `vote`). Minutes extend common definitions with vote, disposition, and conditional logic via `allOf`.

## Editor Setup

Helix (`.helix/languages.toml`) and VS Code (`.vscode/settings.json`) map `*.minutes.yml` → `minutes.schema.yml` and `*.agenda.yml` → `agenda.schema.yml` for yaml-language-server validation on save.

## Usage

### Convert YAML to Markdown + PDF

```bash
bun yml2md.ts sample.minutes.yml
bun yml2md.ts sample.agenda.yml
```

Each command outputs a `.md` and `.pdf` file with the same base name as the input.

### Conversion details

- **Date formatting** — YYYY-MM-DD → "September 17, 2025" (via internal `fmtDate`)
- **Time formatting** — 24h or 12h input → "6:30 PM" (via internal `fmtTime`)
- **Agenda header** — `**AGENDA**` (*draft*) with status in lowercase italics
- **Minutes header** — `**MINUTES**` (*draft*) same format
- **Status placement** — After AGENDA/MINUTES label in parens
- **Meeting type** — In parens after date: `June 1, 2026 (Regular)`

### Motions

- **`final`** — If present, replaces `text` in the rendered output (captures amended wording)
- **`secondary`** — Array of motions applied while main motion was pending
- Recordable secondary motions (displayed when present): `Commit`, `Refer`, `Limit or Extend Debate`, `Previous Question`, `Take a Recess`, `Adjourn`, `Lay on the Table`
- Other secondary motions (e.g., `Amend`) are tracked in data but not rendered

### Minutes Approval

- **Agenda**: "Minutes of **September 17, 2026** to be approved."
- **Minutes**: "Minutes of **September 17, 2026** were **Approved**."
- Common schema (always requires `date`); minutes extends with `result` and conditional `corrections`

## Requirements

- [Bun](https://bun.sh) — runtime for yml2md.ts
- [Pandoc](https://pandoc.org) — PDF conversion
- XeLaTeX — PDF engine (provided by TeX distribution)
- Times New Roman font (or substitute via `md2pdf.sh`)
- yaml-language-server (optional, for editor validation)

```bash
brew bundle
./install-tex.sh          # TinyTeX (~200 MB) instead of full TeX Live
```

## Schemas

- `common.schema.yml` — Shared definitions: `meeting_metadata`, `ceremony`, `motion`, `minutes_approval`, `election`
- `agenda.schema.yml` — Agenda-specific properties (`scheduled_start`); no vote/disposition fields
- `minutes.schema.yml` — Minutes-specific properties (`call_to_order`, `roll_call`, `attestation`); extends motions with `vote`, `disposition`, `final`, `secondary`, `referred_to`, `postponed_to` via `allOf`
