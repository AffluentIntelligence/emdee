-- OAuth 2.1 with PKCE + Dynamic Client Registration for MCP HTTP transport.
-- Clients (Claude Code, Cursor, etc.) self-register via /oauth/register.
-- All access is service-role only; RLS blocks direct client queries.

create table public.oauth_clients (
  client_id     text primary key default gen_random_uuid()::text,
  client_name   text,
  redirect_uris text[] not null,
  created_at    timestamptz not null default now()
);

alter table public.oauth_clients enable row level security;
create policy "no direct client access" on public.oauth_clients for all using (false);

-- Short-lived auth codes (10 min). Marked used=true after exchange to prevent replay.
create table public.oauth_codes (
  code                  text primary key,
  client_id             text not null references public.oauth_clients(client_id) on delete cascade,
  clerk_id              text not null references public.profiles(clerk_id) on delete cascade,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null default 'S256',
  scope                 text not null default 'mcp',
  expires_at            timestamptz not null,
  used                  boolean not null default false
);

alter table public.oauth_codes enable row level security;
create policy "no direct client access" on public.oauth_codes for all using (false);

-- Access tokens stored as SHA-256 hashes, valid for 30 days.
create table public.oauth_tokens (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  client_id   text not null references public.oauth_clients(client_id) on delete cascade,
  clerk_id    text not null references public.profiles(clerk_id) on delete cascade,
  scope       text not null default 'mcp',
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

alter table public.oauth_tokens enable row level security;
create policy "no direct client access" on public.oauth_tokens for all using (false);
