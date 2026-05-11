# Silent Mane

Local-first document management with markdown rendering, knowledge graph, and an MCP server — so any agent (Claude, Cursor, Codex) can read and write into your vault.

## Quick start (consumer)

```bash
npm install -g silent-mane
cd ~/my-vault
mane init      # seeds docs/SILENTMANE.md
mane start     # launches the viewer at http://localhost:5173
mane mcp       # runs the local MCP server over stdio
```

## Quick start (developer)

```bash
npm install
npm run dev    # vite dev server with hot reload, against ./docs
```

## What's in here

- `bin/mane.js` — the `mane` CLI (`init`, `start`, `mcp`)
- `src/web/` — React + TypeScript markdown viewer with cytoscape graph view
- `src/core/indexer.ts` — walks `docs/`, parses `[[wiki links]]`, derives titles
- `src/mcp/server.ts` — MCP server exposing `list_docs`, `read_doc`, `write_doc`, `graph`
- `src/server/dev-plugin.ts` — Vite middleware that serves the index in dev
- `api/index.ts` — Vercel serverless function that serves the index in prod
- `templates/SILENTMANE.md` — seed copied by `mane init`

## Deploying to Vercel

Vercel auto-detects Vite. Set `SILENT_MANE_DOCS` (or commit a `docs/` for a public vault) and it will serve the SPA + the `/api/index` endpoint.

## Conventions for the vault

See `templates/SILENTMANE.md` — the file your `mane init` seeds into a new vault.
