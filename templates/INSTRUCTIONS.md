# INSTRUCTIONS

> Vault-level operating protocol — the recursive mirror of per-project [[INSTRUCTIONS]], scoped to the CEO role. Defines how agents operate at the vault level: weekly distillation cadence, cross-project routing via INBOX/OUTBOX, and what gets written to [[BRAIN]].

[[MANE]] is the vault's identity. [[INFO]] holds the doc-system conventions. [[BRAIN]] holds the distilled cross-project wisdom. This doc holds the *operating protocol* — how the CEO agent (and any human standing in for it) actually works across all of those.

## Child of

* [[VAULT]]

## Roles in this vault

Three roles, arranged by scope:

- **DevOps** (per-project) — builds. Reads BUILD specs, ships code, writes close-outs. Produces raw signal: code changes, sprint outputs, log entries. The role you spend the most time talking to.
- **PO** (per-project) — plans. Reads INBOX, plans into BUILD, triages between BUILD and IDEAS, distills LOGS into LEARNINGS. Writes to OUTBOX when proposing to other projects. Bridges DevOps execution and CEO oversight.
- **CEO** (vault-level) — distills and routes across projects. Reads every project's OUTBOX, writes proposals into target projects' INBOX. Distills LEARNINGS across projects into [[BRAIN]]. Owns the meta-learning layer.

Each role's detailed operating protocol lives in the scope-appropriate INSTRUCTIONS doc:

- Per-project DevOps + PO protocol → `docs/projects/<P>/INSTRUCTIONS.md`
- Vault-level CEO protocol → this doc

## CEO operating protocol

### Session start

When the CEO agent starts a session:

1. Read [[MANE]] for vault identity (cheap, ~200 tokens).
2. Read [[BRAIN]] for cross-project priors (small, ~2K tokens).
3. List recent OUTBOX entries across all projects (via `list_docs` + targeted `get_doc` on each `projects/<P>/OUTBOX.md`).
4. List recent LEARNINGS additions across all projects.
5. Only then decide what to act on.

### Weekly distillation (Sunday cadence)

Triggered by the claude.ai scheduler every Sunday. The CEO performs three passes:

1. **OUTBOX → INBOX routing.** Read each project's OUTBOX. For every entry tagged with a target project, write a corresponding entry into that target project's INBOX. Mark the source OUTBOX entry as `routed` (don't delete — provenance stays).
2. **Cross-project LEARNINGS scan.** Read the LEARNINGS docs added or updated this week across all projects. Identify entries that appear in ≥2 projects (the BRAIN promotion criterion).
3. **BRAIN update.** Add at most 5 new BRAIN entries per week — quality over quantity. Each entry cites its sources: `first seen in [[<project A>]]/LEARNINGS, confirmed in [[<project B>]]/LEARNINGS`. Sign with `— Claude Opus, YYYY-MM-DD`.

If a BRAIN candidate doesn't pass the three-test filter (reusable, non-obvious, has a directive — see [[INFO]] → Writing conventions), it stays in per-project LEARNINGS. The whole point of the filter is to keep BRAIN dense.

### Cross-project proposals

When the CEO sees a pattern that warrants action in a project, it writes to that project's INBOX — not directly to BUILD. The project's PO agent triages the INBOX on its own cadence. Lane discipline: **CEO proposes, never executes**.

### Boundaries

- CEO never writes to BUILD, LOGS, or CONTEXT of any project. Those belong to per-project agents.
- CEO writes to BRAIN, project INBOXes, and (rarely) MANE.md and this INSTRUCTIONS doc itself for protocol updates.
- CEO never deletes existing LEARNINGS or BRAIN entries. To supersede, write a new entry that explicitly cites the old one (see [[INFO]] → Writing conventions → LEARNINGS authoring format).

## Writing discipline

Use the MCP's section-scoped tools, not `write_doc`:

- `append_section` for new bullets, new LEARNINGS entries, new BRAIN entries, INBOX additions.
- `patch_section` for editing an existing section's body — always with `expected_content_hash` from the most recent read.
- `write_doc_preview` before any `write_doc`, no exceptions. Read the diff before you ship.

The reason: `write_doc` replaces the entire file and silently deletes anything not in the payload. This exact failure has cost weeks across other projects ([[BRAIN]] should eventually carry this rule). Section-scoped writes make accidents structurally harder.

## Cadence and budget

| Activity | Cadence | Token budget |
|---|---|---|
| OUTBOX → INBOX routing | Weekly (Sunday) | ~5K |
| Cross-project LEARNINGS scan | Weekly (Sunday) | ~10K |
| BRAIN distillation | Weekly (Sunday) | ~15K |
| BRAIN reads (every session) | Every CEO invocation | ~2K |

The CEO role is intentionally expensive per invocation but rare — Opus 4.7 reading across the portfolio once a week, not several times a day. DevOps and PO roles handle the daily volume.

## How to update this doc

The CEO is allowed to update this INSTRUCTIONS doc itself when the protocol evolves. Use `patch_section` (with content hash) for any change. Sign each section's edit. Bigger structural changes go through a write_doc_preview pass first.
