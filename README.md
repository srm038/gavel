# ronr-minutes — Minutes as Code

Author meeting minutes and agendas in YAML, validate against JSON Schema, render to Markdown + PDF in one command.

```
.yml → render.ts → .md + .pdf
```

No intermediate steps — `bun render.ts <file|glob>` produces both files.

## Philosophy: Minutes as Code

- **YAML as source of truth** — minutes are structured data, not prose
- **JSON Schema validation** — catch structural errors on save (Helix, VS Code)
- **Single renderer** — auto-detects agenda vs. minutes by `m.type`
- **Dual schema, shared definitions** — `common.schema.yml` ground shared fields, agenda/minutes schemas extend via `allOf`
- **Repeatable output** — same YAML always produces same Markdown + PDF

## Document Types

| Type    | Schema               | Sample               | Detection              |
| ------- | -------------------- | -------------------- | ---------------------- |
| Agenda  | `agenda.schema.yml`  | `sample.agenda.yml`  | `m.type === "agenda"`  |
| Minutes | `minutes.schema.yml` | `sample.minutes.yml` | `m.type === "minutes"` |

## Usage

```bash
bun render.ts sample.minutes.yml
bun render.ts sample.agenda.yml
bun render.ts sample.*.yml           # glob — processes all matching files
```

Each file produces `.md` and `.pdf` with the same base name.

## Editor Setup

`.helix/languages.toml` and `.vscode/settings.json` map `*.minutes.yml` → `minutes.schema.yml`, `*.agenda.yml` → `agenda.schema.yml` for yaml-language-server validation on save.

When installed as a dependency, `postinstall.sh` auto-creates `.helix/languages.toml` in the consumer project (if it doesn't already exist). Bun blocks unknown postinstall scripts by default:

```bash
bun pm trust ronr-minutes   # allow postinstall, then re-run it
```

This writes schema paths relative to `node_modules/ronr-minutes/` so editor validation works without manual setup.

## Conventions

- **Motion types** — Omit `type` → renders as "Motion". Explicit types render as labeled.
- **`Commit` / `Refer`** — RONR treats these as equivalent motions. Either may be used.
- **`final`** — If present, replaces `text` in rendered output (captures amended wording).
- **`secondary`** — Motions applied while main motion was pending. Per RONR §48:4, only carried secondaries are rendered; lost and withdrawn are suppressed. Amend is omitted (folded into `final`).
- **`subject`** — Reports use `subject` (not `title`) to avoid confusion with business item titles.
- **Roll call** — Officers, Members, Guests alphabetically by last name. Absent members inline as `*(absent: ...)*`.
- **PDF footer** — Git short SHA on right, page number center, no header.
- **Minutes approval** — Agenda: "to be approved". Minutes: "were **Approved**".
- **Date formatting** — YYYY-MM-DD → "September 17, 2025".
- **Time formatting** — 24h or 12h input → "6:30 PM".

## Required vs Optional

| Field             | Agenda     | Minutes      |
| ----------------- | ---------- | ------------ |
| `type`            | `"agenda"` | `"minutes"`  |
| `scheduled_start` | required   | absent       |
| `call_to_order`   | absent     | required     |
| `roll_call`       | absent     | optional     |
| `adjournment`     | optional   | at least one |
| `recess`          | absent     | at least one |
| `attestation`     | absent     | optional     |

## Requirements

- [Bun](https://bun.sh) — runtime
- [Pandoc](https://pandoc.org) — PDF conversion
- XeLaTeX — PDF engine
- Times New Roman font (or substitute via `scripts/md2pdf.sh`)
- yaml-language-server (optional, for editor validation)

```bash
brew bundle
./scripts/install-tex.sh
```

## Future Improvements

### Schema

- **Committee type on reports** — Distinguish standing committee vs special (ad hoc) committee reports per RONR Order of Business
- **Consent agenda** — Support grouping routine items for single-vote approval
- **Committee of the whole** — Record that assembly went into committee of the whole and the resulting report
- **Election schema** — Support multiple ballots, runoffs, write-ins, preferential voting, abstentions per candidate, motion-to-close-nominations

### Pipeline

- **Better CLI** — `--help`, `--strict` (fail on validation), `--output-dir`, `--format md|pdf|both|html`, `--watch`
- **Agenda→minutes promotion** — Tool to diff, merge, or promote agenda YAML to minutes skeleton after meeting
- **Parallel processing** — Use `Promise.all()` for batch rendering multiple files

## Schemas

- `common.schema.yml` — Shared definitions: `meeting_metadata`, `ceremony`, `motion`, `minutes_approval`, `election`
- `agenda.schema.yml` — Pre-meeting fields (`scheduled_start`); no vote
- `minutes.schema.yml` — Recording fields (`call_to_order`, `roll_call`, `attestation`); extends motions with `vote`, `final`, `secondary`; requires `adjournment` or `recess`
