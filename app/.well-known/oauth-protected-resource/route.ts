export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { origin } = new URL(request.url);
  return Response.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  });
}
