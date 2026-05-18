// Shared lint engine — one implementation, three callsites: the standalone
// lint_doc MCP tool, and the post-write response paths of write_doc and
// patch_section. Returns warnings + structural info; never throws on a
// "bad" doc. Lint is signal, not gate.

const FENCE_RE = /^\s*(?:```|~~~)/;
const H1_RE = /^#\s+(.+?)\s*$/;
const H2_RE = /^##\s+(.+?)\s*$/;
const DECLARED_EDGE_HEADINGS = new Set(["child of", "parent of", "associated with"]);
const INLINE_MENTION_THRESHOLD = 3;

export interface LintWarning {
  code: "missing_preamble" | "inline_mention_without_declared_edge";
  message: string;
  suggestion: string;
  title?: string;
  count?: number;
}

export interface LintInfo {
  has_preamble: boolean;
  preamble_word_count: number;
  has_child_of: boolean;
  declared_edges_total: number;
  inline_mentions: Array<{ title: string; count: number }>;
  section_count: number;
}

export interface LintResult {
  warnings: LintWarning[];
  info: LintInfo;
}

/**
 * Strip fenced code blocks so wiki-links inside them don't count as mentions.
 * Mirrors what the indexer does — the wiki-link parser explicitly ignores
 * fences (see INFO.md → "Fenced code blocks are ignored"). Lint must match
 * the indexer's notion of "real" mentions.
 */
function stripFences(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Locate the preamble region — the block between the H1 and the first H2.
 * Returns `null` when there's no H1 at all (some sub-tier docs may not have
 * one; we don't lint them for preamble).
 */
function findPreambleBlock(content: string): { body: string } | null {
  const lines = content.split("\n");
  let inFence = false;
  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (H1_RE.test(lines[i])) { h1Idx = i; break; }
  }
  if (h1Idx === -1) return null;

  let firstH2Idx = lines.length;
  inFence = false;
  for (let i = h1Idx + 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (H2_RE.test(lines[i])) { firstH2Idx = i; break; }
  }
  const body = lines.slice(h1Idx + 1, firstH2Idx).join("\n").trim();
  return { body };
}

/**
 * Collect every doc title referenced inside the bodies of declared-edge
 * sections (Child of / Parent of / Associated with). These are the titles
 * lint should consider "declared" — inline mentions of these don't count
 * against the missing-edge rule.
 *
 * We collect both leading-link declarations and inline links inside the
 * prose of those bullets, since the user might have meant either to count
 * as an explicit declaration when authoring.
 */
function collectDeclaredTitles(content: string): { titles: Set<string>; sections: Map<string, number> } {
  const lines = content.split("\n");
  const titles = new Set<string>();
  const sections = new Map<string, number>();
  let inFence = false;
  let currentHeading: string | null = null;
  for (const line of lines) {
    if (FENCE_RE.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h2 = line.match(H2_RE);
    if (h2) {
      currentHeading = h2[1].trim().toLowerCase();
      continue;
    }
    if (!currentHeading || !DECLARED_EDGE_HEADINGS.has(currentHeading)) continue;

    sections.set(currentHeading, (sections.get(currentHeading) ?? 0) + 1);
    for (const m of line.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g)) {
      titles.add(m[1].trim().toLowerCase());
    }
  }
  return { titles, sections };
}

/**
 * Count every wiki-link mention inside body prose (outside declared-edge
 * sections, outside fenced code). Returns a map title-lowercased → count.
 */
function collectInlineMentions(content: string): Map<string, number> {
  const lines = content.split("\n");
  const counts = new Map<string, number>();
  let inFence = false;
  let currentHeading: string | null = null;
  for (const line of lines) {
    if (FENCE_RE.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h2 = line.match(H2_RE);
    if (h2) {
      currentHeading = h2[1].trim().toLowerCase();
      continue;
    }
    if (currentHeading && DECLARED_EDGE_HEADINGS.has(currentHeading)) continue;

    for (const m of line.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g)) {
      const title = m[1].trim().toLowerCase();
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
  }
  return counts;
}

function countSections(content: string): number {
  const lines = content.split("\n");
  let count = 0;
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (H2_RE.test(line)) count++;
  }
  return count;
}

export function lintDocContent(content: string): LintResult {
  // Strip fenced code once for the inline-mention checks; preamble + section
  // detection happen on the original so heading boundaries inside fences
  // (rare but possible) don't shift positions.
  const noFenceContent = stripFences(content);

  const preamble = findPreambleBlock(content);
  const has_preamble = !!preamble && preamble.body.length > 0 && !/^>\s*$/m.test(preamble.body)
    ? /^>\s*\S/.test(preamble.body)
    : false;
  const preamble_word_count = preamble
    ? preamble.body.replace(/^>\s*/gm, "").trim().split(/\s+/).filter(Boolean).length
    : 0;

  const { titles: declaredTitles, sections: declaredSections } = collectDeclaredTitles(content);
  const declared_edges_total = Array.from(declaredSections.values()).reduce((a, b) => a + b, 0);
  const has_child_of = declaredSections.has("child of");

  const inlineCounts = collectInlineMentions(noFenceContent);

  const warnings: LintWarning[] = [];

  if (!has_preamble && preamble !== null) {
    warnings.push({
      code: "missing_preamble",
      message:
        "No `>` blockquote summary found directly under the H1. The MCP `get_summary` tool returns empty for this doc — it'll be invisible to cheap retrieval.",
      suggestion:
        "Add a `> one-line summary` line immediately after the H1, then a blank line, then the body. Keep it to 1–3 sentences.",
    });
  }

  const inline_mentions: Array<{ title: string; count: number }> = [];
  for (const [title, count] of inlineCounts) {
    inline_mentions.push({ title, count });
    if (count >= INLINE_MENTION_THRESHOLD && !declaredTitles.has(title)) {
      warnings.push({
        code: "inline_mention_without_declared_edge",
        message: `\`[[${title}]]\` is mentioned ${count} times inline but is not declared in Child of / Parent of / Associated with.`,
        suggestion: `Consider adding \`* [[${title}]]\` to the Associated with section if this is a real cross-cutting connection.`,
        title,
        count,
      });
    }
  }
  inline_mentions.sort((a, b) => b.count - a.count);

  return {
    warnings,
    info: {
      has_preamble,
      preamble_word_count,
      has_child_of,
      declared_edges_total,
      inline_mentions,
      section_count: countSections(content),
    },
  };
}
