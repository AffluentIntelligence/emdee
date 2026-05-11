import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildIndex, type DocIndex, type DocNode, type Link } from "../core/indexer.js";

const docsDir = path.resolve(process.env.SILENT_MANE_DOCS ?? path.join(process.cwd(), "docs"));

const server = new Server(
  { name: "silent-mane", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_docs",
      description:
        "Enumerate every doc in the vault as {path, title, summary}. Cheap entry point — call this first when starting cold to see what exists.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_summary",
      description:
        "Return {path, title, summary} for one doc. Use this when you know which doc to look at but don't want to spend tokens on the full body yet.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Relative path of the doc, e.g. people/KIRAN.md" } },
        required: ["path"],
      },
    },
    {
      name: "get_neighbors",
      description:
        "Return the doc plus its 1-hop neighborhood, categorized by relationship type. Each neighbor is {path, title, summary, note}. `note` is the prose written next to the wiki-link on the declaring side — read it for relationship context. Also returns `mentioned_in`: docs that reference this one in prose without declaring a relationship.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      name: "get_doc",
      description:
        "Return the full markdown content of one doc plus a `sections` array with each H2 section's content_hash. Use the hashes for follow-up patch_section calls. More expensive — only call after deciding (via summary or neighbors) that the full body is needed.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      name: "search",
      description:
        "Case-insensitive substring search over titles, summaries, and full content. Returns top matches as {path, title, summary, snippet}. Use this for cold starts when there is no known path.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: ["query"],
      },
    },
    {
      name: "append_section",
      description:
        "Append markdown content to the end of an existing H2 section. Section-scoped — safer than write_doc for incremental edits. Pass create_if_missing=true to add a new H2 section at the end of the file if the heading doesn't exist (default false, returns section_not_found error). Returns the new content_hash of the section for follow-up patches.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          heading: { type: "string", description: "H2 heading text without the `## ` prefix" },
          body: { type: "string", description: "Markdown body to append to the section" },
          create_if_missing: {
            type: "boolean",
            description: "If true, create the section at end of file when heading is not found. Default false.",
          },
        },
        required: ["path", "heading", "body"],
      },
    },
    {
      name: "patch_section",
      description:
        "Replace the body of an existing H2 section. Version-guarded: pass expected_content_hash from a prior get_doc, append_section, or patch_section response. Mismatch returns a structured version_conflict error with the actual hash so you can re-read and reconcile. This is the ONLY safe path for destructive section edits — never use write_doc for incremental edits, it replaces the entire file and silently loses content.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          heading: { type: "string", description: "H2 heading text without the `## ` prefix" },
          body: { type: "string", description: "New body content for the section" },
          expected_content_hash: {
            type: "string",
            description: "Short hash of the section's current body (from get_doc.sections or a previous mutation's response).",
          },
        },
        required: ["path", "heading", "body", "expected_content_hash"],
      },
    },
    {
      name: "write_doc_preview",
      description:
        "Preview the diff that write_doc would produce. ALWAYS call this before write_doc — write_doc replaces the entire file and silently destroys sections not present in the new payload. If the change is section-scoped, prefer append_section or patch_section instead.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string", description: "Proposed new content for the entire file" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "write_doc",
      description:
        "Create or overwrite a markdown doc at the given relative path. DESTRUCTIVE — full-file replacement, silently deletes any content not in the new payload. Use append_section or patch_section for incremental edits. Always run write_doc_preview first to see what would be lost.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  ],
}));

function safeResolve(rel: string): string {
  const resolved = path.resolve(docsDir, rel);
  if (!resolved.startsWith(docsDir)) throw new Error("path escapes docs directory");
  return resolved;
}

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

// --- Section parsing (H2-scoped, fence-aware) ---

interface SectionLoc {
  heading: string;
  headingLineIdx: number;
  bodyStartLineIdx: number;
  bodyEndLineIdx: number; // exclusive
}

const FENCE_RE = /^\s*(?:```|~~~)/;
const H2_RE = /^##\s+(.+?)\s*$/;

function parseSections(content: string): SectionLoc[] {
  const lines = content.split("\n");
  const sections: SectionLoc[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = lines[i].match(H2_RE);
    if (!m) continue;
    if (sections.length > 0) {
      sections[sections.length - 1].bodyEndLineIdx = i;
    }
    sections.push({
      heading: m[1].trim(),
      headingLineIdx: i,
      bodyStartLineIdx: i + 1,
      bodyEndLineIdx: lines.length,
    });
  }
  return sections;
}

function findSection(sections: SectionLoc[], heading: string): SectionLoc | undefined {
  const target = heading.replace(/^##\s*/, "").trim().toLowerCase();
  return sections.find((s) => s.heading.toLowerCase() === target);
}

function extractBody(content: string, loc: SectionLoc): string {
  const lines = content.split("\n");
  const bodyLines = lines.slice(loc.bodyStartLineIdx, loc.bodyEndLineIdx);
  return bodyLines.join("\n").replace(/^\s*\n+/, "").replace(/\n+\s*$/, "");
}

function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 16);
}

// --- Diff for write_doc_preview ---

function simpleDiff(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  let commonPrefix = 0;
  while (
    commonPrefix < beforeLines.length &&
    commonPrefix < afterLines.length &&
    beforeLines[commonPrefix] === afterLines[commonPrefix]
  ) {
    commonPrefix++;
  }
  let commonSuffix = 0;
  while (
    commonSuffix < beforeLines.length - commonPrefix &&
    commonSuffix < afterLines.length - commonPrefix &&
    beforeLines[beforeLines.length - 1 - commonSuffix] === afterLines[afterLines.length - 1 - commonSuffix]
  ) {
    commonSuffix++;
  }
  const out: string[] = [];
  out.push(`--- before (${beforeLines.length} lines)`);
  out.push(`+++ after  (${afterLines.length} lines)`);
  if (commonPrefix > 0) out.push(`  … ${commonPrefix} unchanged …`);
  for (let i = commonPrefix; i < beforeLines.length - commonSuffix; i++) {
    out.push(`- ${beforeLines[i]}`);
  }
  for (let i = commonPrefix; i < afterLines.length - commonSuffix; i++) {
    out.push(`+ ${afterLines[i]}`);
  }
  if (commonSuffix > 0) out.push(`  … ${commonSuffix} unchanged …`);
  return out.join("\n");
}

// --- Neighbors (unchanged) ---

interface NeighborRef {
  path: string;
  title: string;
  summary: string;
  note: string;
}

function buildNeighbors(idx: DocIndex, focal: DocNode) {
  const byPath = new Map(idx.docs.map((d) => [d.path, d]));
  const byTitle = new Map<string, DocNode>();
  for (const d of idx.docs) byTitle.set(d.title.toLowerCase(), d);

  const resolve = (titleOrPath: string): DocNode | undefined =>
    byPath.get(titleOrPath) ?? byTitle.get(titleOrPath.toLowerCase());

  const refFor = (n: DocNode, note: string): NeighborRef => ({
    path: n.path,
    title: n.title,
    summary: n.summary,
    note,
  });

  const declaredParents = new Map<string, NeighborRef>();
  for (const l of focal.parents) {
    const n = resolve(l.title);
    if (n) declaredParents.set(n.path, refFor(n, l.note));
  }
  const declaredChildren = new Map<string, NeighborRef>();
  for (const l of focal.children) {
    const n = resolve(l.title);
    if (n) declaredChildren.set(n.path, refFor(n, l.note));
  }
  const declaredAssoc = new Map<string, NeighborRef>();
  for (const l of focal.associates) {
    const n = resolve(l.title);
    if (n) declaredAssoc.set(n.path, refFor(n, l.note));
  }

  const focalTitleLower = focal.title.toLowerCase();
  const matchesFocal = (l: Link) => l.title.toLowerCase() === focalTitleLower;

  for (const other of idx.docs) {
    if (other.path === focal.path) continue;
    const asChild = other.children.find(matchesFocal);
    if (asChild && !declaredParents.has(other.path)) {
      declaredParents.set(other.path, refFor(other, asChild.note));
    }
    const asParent = other.parents.find(matchesFocal);
    if (asParent && !declaredChildren.has(other.path)) {
      declaredChildren.set(other.path, refFor(other, asParent.note));
    }
    const asAssoc = other.associates.find(matchesFocal);
    if (asAssoc && !declaredAssoc.has(other.path)) {
      declaredAssoc.set(other.path, refFor(other, asAssoc.note));
    }
  }

  const declared = new Set<string>([
    ...declaredParents.keys(),
    ...declaredChildren.keys(),
    ...declaredAssoc.keys(),
  ]);
  const mentionedIn: { path: string; title: string; summary: string }[] = [];
  for (const other of idx.docs) {
    if (other.path === focal.path) continue;
    if (declared.has(other.path)) continue;
    if (other.mentions.some((m) => m.toLowerCase() === focalTitleLower)) {
      mentionedIn.push({ path: other.path, title: other.title, summary: other.summary });
    }
  }

  return {
    path: focal.path,
    title: focal.title,
    summary: focal.summary,
    parents: [...declaredParents.values()],
    children: [...declaredChildren.values()],
    associated: [...declaredAssoc.values()],
    mentioned_in: mentionedIn,
  };
}

function makeSnippet(content: string, query: string, radius = 60): string {
  const i = content.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return "";
  const start = Math.max(0, i - radius);
  const end = Math.min(content.length, i + query.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  return prefix + content.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = args ?? {};

  switch (name) {
    case "list_docs": {
      const idx = await buildIndex(docsDir);
      return json(
        idx.docs.map((d) => ({ path: d.path, title: d.title, summary: d.summary }))
      );
    }

    case "get_summary": {
      const idx = await buildIndex(docsDir);
      const doc = idx.docs.find((d) => d.path === String(a.path));
      if (!doc) throw new Error(`no such doc: ${a.path}`);
      return json({ path: doc.path, title: doc.title, summary: doc.summary });
    }

    case "get_neighbors": {
      const idx = await buildIndex(docsDir);
      const focal = idx.docs.find((d) => d.path === String(a.path));
      if (!focal) throw new Error(`no such doc: ${a.path}`);
      return json(buildNeighbors(idx, focal));
    }

    case "get_doc": {
      const idx = await buildIndex(docsDir);
      const doc = idx.docs.find((d) => d.path === String(a.path));
      if (!doc) throw new Error(`no such doc: ${a.path}`);
      const sections = parseSections(doc.content).map((s) => ({
        heading: s.heading,
        content_hash: hashBody(extractBody(doc.content, s)),
      }));
      return json({
        path: doc.path,
        title: doc.title,
        summary: doc.summary,
        content: doc.content,
        sections,
      });
    }

    case "search": {
      const query = String(a.query ?? "").trim();
      if (!query) return json([]);
      const limit = Math.max(1, Math.min(50, Number(a.limit ?? 10)));
      const idx = await buildIndex(docsDir);
      const q = query.toLowerCase();
      const hits = idx.docs
        .map((d) => {
          const titleHit = d.title.toLowerCase().includes(q);
          const summaryHit = d.summary.toLowerCase().includes(q);
          const contentHit = d.content.toLowerCase().includes(q);
          if (!titleHit && !summaryHit && !contentHit) return null;
          const score = (titleHit ? 3 : 0) + (summaryHit ? 2 : 0) + (contentHit ? 1 : 0);
          return {
            score,
            ref: {
              path: d.path,
              title: d.title,
              summary: d.summary,
              snippet: titleHit ? "" : makeSnippet(d.content, query),
            },
          };
        })
        .filter((x): x is { score: number; ref: NeighborRef & { snippet: string } } => x !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.ref);
      return json(hits);
    }

    case "append_section": {
      const file = safeResolve(String(a.path));
      const heading = String(a.heading ?? "").trim();
      const body = String(a.body ?? "");
      const createIfMissing = Boolean(a.create_if_missing ?? false);
      if (!heading) throw new Error("heading required");

      let content = "";
      try {
        content = await readFile(file, "utf8");
      } catch {
        return json({ error: "doc_not_found", path: a.path });
      }

      const sections = parseSections(content);
      const target = findSection(sections, heading);

      if (!target) {
        if (!createIfMissing) {
          return json({
            error: "section_not_found",
            heading,
            available: sections.map((s) => s.heading),
            hint: "Pass create_if_missing=true to create the section at end of file.",
          });
        }
        const sep = content.endsWith("\n") ? "" : "\n";
        const newSection = `\n## ${heading}\n\n${body}\n`;
        const newContent = content + sep + newSection;
        await writeFile(file, newContent, "utf8");
        return json({ ok: true, created: true, content_hash: hashBody(body.trim()) });
      }

      const lines = content.split("\n");
      const sectionLines = lines.slice(target.headingLineIdx, target.bodyEndLineIdx);
      while (sectionLines.length > 1 && sectionLines[sectionLines.length - 1].trim() === "") {
        sectionLines.pop();
      }
      sectionLines.push("");
      sectionLines.push(...body.split("\n"));
      sectionLines.push("");

      const newLines = [
        ...lines.slice(0, target.headingLineIdx),
        ...sectionLines,
        ...lines.slice(target.bodyEndLineIdx),
      ];
      const newContent = newLines.join("\n");
      await writeFile(file, newContent, "utf8");

      const newSections = parseSections(newContent);
      const newTarget = findSection(newSections, heading);
      const newBody = newTarget ? extractBody(newContent, newTarget) : "";
      return json({ ok: true, content_hash: hashBody(newBody) });
    }

    case "patch_section": {
      const file = safeResolve(String(a.path));
      const heading = String(a.heading ?? "").trim();
      const body = String(a.body ?? "");
      const expected = String(a.expected_content_hash ?? "");
      if (!heading) throw new Error("heading required");
      if (!expected) throw new Error("expected_content_hash required");

      let content = "";
      try {
        content = await readFile(file, "utf8");
      } catch {
        return json({ error: "doc_not_found", path: a.path });
      }

      const sections = parseSections(content);
      const target = findSection(sections, heading);
      if (!target) {
        return json({
          error: "section_not_found",
          heading,
          available: sections.map((s) => s.heading),
        });
      }

      const currentBody = extractBody(content, target);
      const currentHash = hashBody(currentBody);
      if (currentHash !== expected) {
        return json({
          error: "version_conflict",
          heading,
          expected_content_hash: expected,
          actual_content_hash: currentHash,
          message:
            "Section was modified since you last read it. Call get_doc again and reconcile.",
        });
      }

      const lines = content.split("\n");
      const newBodyLines = body.split("\n");
      const newLines = [
        ...lines.slice(0, target.headingLineIdx + 1),
        "",
        ...newBodyLines,
        "",
        ...lines.slice(target.bodyEndLineIdx),
      ];
      const newContent = newLines.join("\n");
      await writeFile(file, newContent, "utf8");
      return json({ ok: true, content_hash: hashBody(body.trim()) });
    }

    case "write_doc_preview": {
      const file = safeResolve(String(a.path));
      const newContent = String(a.content ?? "");
      let before = "";
      try {
        before = await readFile(file, "utf8");
      } catch {
        return json({
          action: "create",
          path: a.path,
          new_size_lines: newContent.split("\n").length,
        });
      }
      if (before === newContent) {
        return json({ action: "no_change", path: a.path });
      }
      const beforeSections = parseSections(before).map((s) => s.heading);
      const afterSections = parseSections(newContent).map((s) => s.heading);
      const removed = beforeSections.filter((h) => !afterSections.includes(h));
      return json({
        action: "replace",
        path: a.path,
        sections_removed: removed,
        sections_before: beforeSections,
        sections_after: afterSections,
        diff: simpleDiff(before, newContent),
      });
    }

    case "write_doc": {
      const file = safeResolve(String(a.path));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, String(a.content ?? ""), "utf8");
      return { content: [{ type: "text", text: `wrote ${a.path}` }] };
    }

    default:
      throw new Error(`unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
