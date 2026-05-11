# Silent Mane

Local-first knowledge graph backed by plain markdown. Humans browse it through a React renderer; agents (Claude, Cursor, Codex) read and write the same files through an MCP server. The vault is the source of truth — anything an LLM says traces back to a file you wrote.

## Why

LLM agents need a stable, human-readable substrate to read and write their own context over time. Most knowledge-graph tools are either built for humans (Obsidian) or built for agents (vector stores). Silent Mane is a single substrate for both: the markdown a human edits is the exact bytes an agent reads, with no hidden index, no parallel summaries, no schema gymnastics. Build up a working journal that survives across sessions.

## Quick start (consumer)

```bash
npm install -g silent-mane
cd ~/my-vault
mane init      # seeds the entry doc, conventions, and a sample branch
mane start     # launches the viewer at http://localhost:5173
mane mcp       # runs the local MCP server over stdio
```

`mane init` lays down:

- `docs/MANE.md` — vault entry point
- `docs/VAULT.md` — meta-pillar grouping the system docs below
- `docs/INFO.md` — conventions (filenames, relationships, writing format)
- `docs/INSTRUCTIONS.md` — CEO operating protocol for cross-project agents
- `docs/BRAIN.md` — cross-project distilled wisdom (always-loaded prior)
- `docs/WORKFLOWS.md` — concrete procedures the vault runs
- `docs/SAMPLE.md` + `docs/sample/` — pedagogical examples; delete with `rm -rf docs/sample/` once you've read them

Set `SILENT_MANE_ENTRY=your-file.md` to override the default entry name.

## Quick start (developer)

```bash
npm install
npm run dev    # Vite dev server with hot reload, reading ./docs
```

## MCP tools

The MCP server (`mane mcp`) exposes:

- `list_docs` — every doc as `{path, title, summary}`. Cold-start enumeration.
- `get_summary(path)` — one doc's `{path, title, summary}`. Cheap.
- `get_neighbors(path)` — focal doc + 1-hop neighbors, categorized as `parents / children / associated`. Each neighbor carries the prose note attached to its wiki-link.
- `get_doc(path)` — full markdown plus per-section `content_hash` for safe patches.
- `search(query, limit?)` — substring match over titles, summaries, content.
- `append_section(path, heading, body, create_if_missing?)` — section-scoped append. Safer than `write_doc` for incremental edits.
- `patch_section(path, heading, body, expected_content_hash)` — version-guarded section replacement. Mismatched hash returns a structured `version_conflict`.
- `write_doc_preview(path, content)` — diff and list of removed sections before any full-file write.
- `write_doc(path, content)` — full-file replace (destructive; prefer the section-scoped tools).

## Design principles

1. **Markdown is the only source of truth.** No persisted index, no derived database, no parallel summaries.
2. **Same substrate, different lenses.** Renderer and MCP read the same files via the same indexer. Nothing the LLM sees is invisible to the human.
3. **Convention over schema.** Light structure — H1 + `> blockquote` summary + three relationship sections (`## Parent of`, `## Child of`, `## Associated with`). The LLM parses English natively; rigid schemas only add authoring friction.
4. **Single summary per doc.** The blockquote under the H1 is the routing decision for both humans and LLMs.

## What's in here

- `bin/mane.js` — the `mane` CLI (`init`, `start`, `mcp`)
- `src/core/indexer.ts` — walks `docs/`, parses wiki-links and relationship sections, derives summaries, skips fenced code blocks
- `src/mcp/server.ts` — MCP server with the tool surface above
- `src/web/` — React + TypeScript renderer (Toast UI Editor + Cytoscape egocentric graph, category-colored nodes)
- `src/server/dev-plugin.ts` — Vite middleware that serves the index in dev
- `api/index.ts` — Vercel serverless function that serves the index in prod
- `templates/` — vault seeds plus typed templates for `PROJECT`, `NOVEL`, `PERSON`, `HACKATHON`, `CONCEPT`. The engineering layer is type-agnostic — types are conventions plus templates, not schema. Adding a new type is one new file.

## Conventions for the vault

The seeded `docs/INFO.md` is the full conventions reference: filename rules, the relationship grammar (first wiki-link on each bullet is the declared edge, inline links are context-only), the LEARNINGS authoring format, attribution lines for provenance. Read it once when you start a vault, refer back when you forget how something works.

## Deploying to Vercel

Vercel auto-detects Vite. Set `SILENT_MANE_DOCS` (or commit a `docs/` for a public vault) and it will serve the SPA plus the `/api/index` endpoint. The default `.gitignore` excludes `docs/` so your vault stays private; remove that line if you want the vault public.

## Status

Early. Indexer + MCP + renderer all working end-to-end; conventions still evolving. Expect breaking changes to seed names and tool surfaces until 0.1.0.
