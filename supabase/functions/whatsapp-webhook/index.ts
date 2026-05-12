// ─── whatsapp-webhook ──────────────────────────────────────────────────────────
// Handles Meta WhatsApp Cloud API webhooks for delivery status updates.
//
// 1. GET  /functions/v1/whatsapp-webhook -> Verification from Meta Dashboard
// 2. POST /functions/v1/whatsapp-webhook -> Real-time status callbacks (sent, delivered, read, failed)
//
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// STATUS_RANK: Priority mapping to ensure we don't regress status (read > delivered > sent)
const STATUS_RANK: Record<string, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
  failed: 2, // failed is terminal
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── 1. WEBHOOK VERIFICATION (GET) ─────────────────────────────────────────
  // Used by Meta to verify the endpoint when you first configure it in the dashboard.
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // The VERIFY_TOKEN should match what you enter in the Meta Developer Console.
    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "weavly_webhook_verify";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[whatsapp-webhook] Verification successful");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── 2. EVENT HANDLING (POST) ──────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Signature verification
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (appSecret) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) {
      console.warn("[whatsapp-webhook] Missing signature header");
      return new Response("Missing signature", { status: 401 });
    }
    const parts = signature.split("=");
    if (parts.length !== 2 || parts[0] !== "sha256") {
      console.warn("[whatsapp-webhook] Invalid signature format");
      return new Response("Invalid signature format", { status: 401 });
    }
    const expectedSignature = parts[1];
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const actualSignature = signatureArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    if (actualSignature !== expectedSignature) {
      console.warn("[whatsapp-webhook] Invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }
  } else {
    console.log("[whatsapp-webhook] META_APP_SECRET not set, signature verification disabled");
  }

  try {
    const body = JSON.parse(rawBody);

    // Meta webhooks follow a nested structure: entry[] -> changes[] -> value
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // We specifically care about 'statuses' updates
    if (!value?.statuses?.[0]) {
      // Not a status update (maybe an incoming message), acknowledge and ignore
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    const statusObj = value.statuses[0];
    const metaMessageId = statusObj.id; // Corresponds to our meta_message_id
    const status = statusObj.status;    // 'sent', 'delivered', 'read', 'failed'
    
    if (!metaMessageId || !status) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    console.log(`[whatsapp-webhook] Status update: ${metaMessageId} -> ${status}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch existing log record
    const { data: existing, error: fetchError } = await supabase
      .from("whatsapp_delivery_log")
      .select("id, status")
      .eq("meta_message_id", metaMessageId)
      .maybeSingle();

    if (fetchError || !existing) {
      console.warn(`[whatsapp-webhook] No record found for meta_message_id: ${metaMessageId}`);
      return new Response(JSON.stringify({ ok: true, warning: "Not found" }), { status: 200 });
    }

    // 2. Prevent status regressions
    const currentRank = STATUS_RANK[existing.status] ?? -1;
    const newRank = STATUS_RANK[status] ?? -1;

    if (newRank <= currentRank && status !== 'failed') {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "regression" }), { status: 200 });
    }

    // 3. Update status and timestamps
    const now = new Date().toISOString();
    const updatePayload: any = { status };
    if (status === "delivered") updatePayload.delivered_at = now;
    if (status === "read") updatePayload.read_at = now;
    if (status === "failed") {
      updatePayload.error_message = statusObj.errors?.[0]?.message ?? "Unknown Meta error";
    }

    const { error: updateError } = await supabase
      .from("whatsapp_delivery_log")
      .update(updatePayload)
      .eq("id", existing.id);

    if (updateError) {
      console.error("[whatsapp-webhook] Update failed:", updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, status }), { status: 200 });

  } catch (err) {
    console.error("[whatsapp-webhook] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 200 }); // Always 200 to avoid Meta retries if non-critical
  }
});
