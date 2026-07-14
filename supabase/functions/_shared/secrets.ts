import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getSupabaseSecretsFromDictionary(): string[] {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const values = Object.entries(parsed).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].length > 0
    );
    values.sort(([left], [right]) => Number(right === "default") - Number(left === "default"));
    return values.map(([, value]) => value).filter((value): value is string =>
      typeof value === "string" && value.length > 0
    );
  } catch {
    return [];
  }
}

export function getSupabaseServiceKey(): string {
  const key =
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SB_SECRET_KEY") ??
    getSupabaseSecretsFromDictionary()[0] ??
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

function isAcceptedInternalSecret(presented: string | null): boolean {
  if (!presented) return false;

  const accepted = new Set([
    Deno.env.get("INTERNAL_FUNCTION_SECRET"),
    Deno.env.get("SUPABASE_SECRET_KEY"),
    Deno.env.get("SB_SECRET_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ...getSupabaseSecretsFromDictionary(),
  ].filter((value): value is string => typeof value === "string" && value.length > 0));

  return accepted.has(presented);
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
  if (isAcceptedInternalSecret(presented)) {
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

  if (isAcceptedInternalSecret(presented)) {
    return null;
  }

  return unauthorizedResponse(headers);
}
