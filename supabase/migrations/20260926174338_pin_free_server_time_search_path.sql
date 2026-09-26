-- Fix package F3: pin free_server_time()'s search_path (security advisor
-- function_search_path_mutable, EVIDENCE E22). The body only calls now(),
-- which always resolves in pg_catalog, so behavior is unchanged.

ALTER FUNCTION public.free_server_time() SET search_path = '';
