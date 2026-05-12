import path from "node:path";

export const dynamic = "force-dynamic";

// Returns the MCP connection command appropriate for this instance.
// Local (EMDEE_DOCS set): stdio command pointing at the docs folder.
// Cloud (no EMDEE_DOCS): HTTP command placeholder using the request origin.
export async function GET(request: Request) {
  const docsDir = process.env.EMDEE_DOCS;

  if (docsDir) {
    const resolved = path.resolve(docsDir);
    const command = `claude mcp add emdee -- npx emdee mcp --docs "${resolved}"`;
    return Response.json({ mode: "local", command });
  }

  const origin = new URL(request.url).origin;
  // Cloud HTTP MCP command — client does OAuth on first connect, no token needed in the command.
  const command = `claude mcp add emdee --transport http ${origin}/api/mcp`;
  return Response.json({ mode: "cloud", command });
}
