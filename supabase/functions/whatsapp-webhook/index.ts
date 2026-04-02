// ─── whatsapp-webhook ──────────────────────────────────────────────────────────
// Receives Interakt delivery callbacks and updates whatsapp_delivery_log.
//
// POST /functions/v1/whatsapp-webhook
//
// Security:
//   • Validates the Interakt-Signature header (HMAC-SHA256 of raw body)
//   • Uses service_role key to bypass RLS and upsert status
//
// Expected Interakt payload types handled:
//   message_api_sent      → 'sent'      (rarely called back, but handled)
//   message_api_delivered → 'delivered'
//   message_api_read      → 'read'
//   message_api_failed    → 'failed'
//
// Correlation strategy:
//   1. Match by data.message.id (interakt_message_id) — most reliable
//   2. Fall back to data.customer.traits.callbackData if present
//
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── HMAC Verification ────────────────────────────────────────────────────────

/**
 * Verifies the Interakt-Signature header using HMAC-SHA256.
 * Interakt signs the raw request body with your configured webhook secret.
 * Header format: "sha256=<hex-digest>"
 */
async function verifyInteraktSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;

  const receivedHex = signatureHeader.slice(prefix.length);

  const keyData = new TextEncoder().encode(secret);
  const msgData = new TextEncoder().encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison via a simple XOR approach to avoid timing attacks
  if (computedHex.length !== receivedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ receivedHex.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Status Mapping ───────────────────────────────────────────────────────────

type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

function mapInteraktTypeToStatus(type: string): DeliveryStatus | null {
  const map: Record<string, DeliveryStatus> = {
    message_api_sent: "sent",
    message_api_delivered: "delivered",
    message_api_read: "read",
    message_api_failed: "failed",
    // Campaign variants — treated the same way
    message_campaign_sent: "sent",
    message_campaign_delivered: "delivered",
    message_campaign_read: "read",
    message_campaign_failed: "failed",
  };
  return map[type] ?? null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // ── 0. Only allow POST ────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── 1. Read raw body (required for HMAC verification before parsing) ──────
  const rawBody = await req.text();

  // ── 2. Validate HMAC signature ────────────────────────────────────────────
  const webhookSecret = Deno.env.get("INTERAKT_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[whatsapp-webhook] INTERAKT_WEBHOOK_SECRET not configured");
    // Fail open in dev (no secret set) but log loudly
    // In production this should be set — we return 500 to signal misconfiguration
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signatureHeader = req.headers.get("Interakt-Signature");
  const signatureValid = await verifyInteraktSignature(rawBody, signatureHeader, webhookSecret);

  if (!signatureValid) {
    console.warn("[whatsapp-webhook] Signature validation failed", {
      receivedHeader: signatureHeader,
    });
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 3. Parse payload ──────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = typeof payload.type === "string" ? payload.type : "";
  const status = mapInteraktTypeToStatus(eventType);

  // Ignore event types we don't handle (e.g. message_received — incoming messages)
  if (!status) {
    console.log(`[whatsapp-webhook] Ignoring unhandled event type: ${eventType}`);
    return new Response(JSON.stringify({ ok: true, ignored: true, type: eventType }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 4. Extract correlation fields from payload ────────────────────────────
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const message = (data.message ?? {}) as Record<string, unknown>;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const traits = (customer.traits ?? {}) as Record<string, unknown>;

  // Primary correlation key: the message ID Interakt assigned when we sent it
  const interaktMessageId = typeof message.id === "string" ? message.id : null;

  // Fallback correlation key: our own callbackData string echoed back
  const callbackData = typeof traits.callbackData === "string"
    ? traits.callbackData
    : typeof data.callbackData === "string"
    ? data.callbackData
    : null;

  // Phone number for logging
  const phoneNumber = typeof customer.phone_number === "string" ? customer.phone_number : null;

  if (!interaktMessageId && !callbackData) {
    console.warn("[whatsapp-webhook] No correlation key found in payload", { eventType, data });
    // Still return 200 — don't cause Interakt to retry/disable the webhook
    return new Response(
      JSON.stringify({ ok: true, warning: "No correlation key; status not updated" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── 5. Upsert into whatsapp_delivery_log ──────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Build the update payload — only advance status (never go backwards)
  // Priority: sent < delivered < read / failed
  const STATUS_RANK: Record<DeliveryStatus, number> = {
    sent: 0,
    delivered: 1,
    read: 2,
    failed: 2,  // failed is terminal, same rank as read
  };

  const now = new Date().toISOString();
  const timestampFields: Record<string, string | null> = {
    delivered_at: status === "delivered" ? now : null,
    read_at: status === "read" ? now : null,
  };

  // Remove null timestamp fields — don't overwrite existing timestamps
  const cleanTimestamps = Object.fromEntries(
    Object.entries(timestampFields).filter(([, v]) => v !== null),
  );

  let updateResult: { error: { message: string } | null };

  if (interaktMessageId) {
    // Primary path: match by interakt_message_id
    // Only update if the new status is higher rank than current (no regressions)
    const { data: existing, error: fetchError } = await supabase
      .from("whatsapp_delivery_log")
      .select("id, status")
      .eq("interakt_message_id", interaktMessageId)
      .maybeSingle();

    if (fetchError) {
      console.error("[whatsapp-webhook] Fetch error:", fetchError.message);
      return new Response(JSON.stringify({ error: "Database fetch error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!existing) {
      console.warn("[whatsapp-webhook] No log row found for interakt_message_id:", interaktMessageId);
      return new Response(
        JSON.stringify({ ok: true, warning: "No matching delivery log row found" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const currentRank = STATUS_RANK[existing.status as DeliveryStatus] ?? -1;
    const newRank = STATUS_RANK[status];

    if (newRank < currentRank) {
      console.log(`[whatsapp-webhook] Ignoring status regression: ${existing.status} → ${status}`);
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "status regression" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    updateResult = await supabase
      .from("whatsapp_delivery_log")
      .update({
        status,
        interakt_callback_data: callbackData ?? existing.status,
        ...cleanTimestamps,
      })
      .eq("id", existing.id);

  } else {
    // Fallback path: match by callbackData string
    const { data: existing, error: fetchError } = await supabase
      .from("whatsapp_delivery_log")
      .select("id, status")
      .eq("interakt_callback_data", callbackData)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !existing) {
      console.warn("[whatsapp-webhook] No log row found for callbackData:", callbackData);
      return new Response(
        JSON.stringify({ ok: true, warning: "No matching delivery log row found" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const currentRank = STATUS_RANK[existing.status as DeliveryStatus] ?? -1;
    const newRank = STATUS_RANK[status];

    if (newRank < currentRank) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "status regression" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    updateResult = await supabase
      .from("whatsapp_delivery_log")
      .update({ status, ...cleanTimestamps })
      .eq("id", existing.id);
  }

  if (updateResult.error) {
    console.error("[whatsapp-webhook] Update failed:", updateResult.error.message);
    return new Response(JSON.stringify({ error: "Database update failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[whatsapp-webhook] Status updated: ${eventType} → ${status}`, {
    interaktMessageId,
    callbackData,
    phoneNumber,
  });

  return new Response(JSON.stringify({ ok: true, status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
