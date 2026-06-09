-- SPRINT-041 (admin dashboard): per-user MCP activity aggregate view.
-- Used by /admin to show DAU/WAU/MAU and the per-user activity table
-- without reading raw mcp_activity rows in application code.

CREATE OR REPLACE VIEW public.user_activity_stats AS
  SELECT
    clerk_id,
    MAX(created_at)                                                          AS last_active,
    COUNT(*)                                                                 AS total_calls,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')           AS calls_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')          AS calls_7d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')         AS calls_30d
  FROM public.mcp_activity
  GROUP BY clerk_id;
