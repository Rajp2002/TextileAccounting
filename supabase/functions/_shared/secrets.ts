import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getSupabaseSecretFromDictionary(): string | null {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const defaultKey = parsed.default;
    if (typeof defaultKey === "string" && defaultKey.length > 0) {
      return defaultKey;
    }

    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getSupabaseServiceKey(): string {
  const key =
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SB_SECRET_KEY") ??
    getSupabaseSecretFromDictionary() ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!key) {
    throw new Error("Missing Supabase admin key");
  }

  return key;
}

export function createSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL");
  }

  return createClient(supabaseUrl, getSupabaseServiceKey());
}

function getPresentedSecret(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return req.headers.get("apikey");
}

function unauthorizedResponse(headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      ...(headers ?? {}),
      "Content-Type": "application/json",
    },
  });
}

export function requireInternalAuthorization(req: Request, headers?: HeadersInit): Response | null {
  const presented = getPresentedSecret(req);
  if (presented && presented === getSupabaseServiceKey()) {
    return null;
  }

  return unauthorizedResponse(headers);
}

export function requireCronOrInternalAuthorization(req: Request, headers?: HeadersInit): Response | null {
  const presented = getPresentedSecret(req);
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (presented && cronSecret && presented === cronSecret) {
    return null;
  }

  if (presented && presented === getSupabaseServiceKey()) {
    return null;
  }

  return unauthorizedResponse(headers);
}
