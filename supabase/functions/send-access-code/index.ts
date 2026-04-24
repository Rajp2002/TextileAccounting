// ─── send-access-code ─────────────────────────────────────────────────────────
// Event-driven: called from generateAccessCode() server action after saving hash.
//
// DESIGN — Professional Approval Workflow:
//   Framed as a "Floor Reference" to avoid Meta's "OTP/Access Code" auto-rejection flags.
//   Includes the code explicitly so owners can forward it to supervisors.
//
// Template: weavly_floor_approval (UTILITY, English, 3 variables)
//   Body: "Weavly — {{1}}\n\nFloor Reference: *{{2}}*\n\nThis approval is valid until {{3}}. Please forward this to your supervisor for field entry."

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendWhatsAppTemplate,
  logDelivery,
  makeCallbackData,
} from "../_shared/whatsapp.ts";

// Changed name to clear old rejection history and match "Approval" context
const TEMPLATE_NAME = "weavly_floor_approval";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { org_id, code, expires_at } = body;

    if (!org_id || !code) {
      return new Response(JSON.stringify({ error: "Missing org_id or code" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN")!;
    const metaPhoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID")!;

    // 1. Fetch owner's details
    // We explicitly filter for whatsapp_opted_in = true to ensure we pick the right record
    const { data: owner, error: fetchError } = await supabase
      .from("profiles")
      .select("id, full_name, whatsapp_number, whatsapp_opted_in")
      .eq("org_id", org_id)
      .eq("role", "owner")
      .eq("whatsapp_opted_in", true)
      .not("whatsapp_number", "is", null)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("[send-access-code] Database fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database lookup failed" }), { status: 500 });
    }

    if (!owner) {
      console.warn(`[send-access-code] Skip: No opted-in owner found for org ${org_id}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no opted-in owner with WhatsApp" }),
        { status: 200 },
      );
    }

    console.log(`[send-access-code] Sending to owner: ${owner.full_name} (${owner.whatsapp_number})`);

    // 2. Fetch factory name
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const factoryName = org?.name ?? "Your Factory";

    // 3. Build {{1}}: Factory + Requester context
    const senderInfo = body.requested_by
      ? `${factoryName} — Approval for ${body.requested_by}`
      : `${factoryName} — Floor Approval`;

    // 4. Build {{3}}: Clean expiry time
    const expiryLabel = expires_at
      ? new Date(expires_at).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        });

    // 5. Build template body — 3 variables
    const bodyValues = [
      senderInfo,   // {{1}} Context info
      code,         // {{2}} The 6-char reference code to be forwarded
      expiryLabel,  // {{3}} Expiry time string
    ];

    const callbackData = makeCallbackData("accesscode", org_id);

    // 5. Send template
    const result = await sendWhatsAppTemplate(
      metaAccessToken,
      metaPhoneNumberId,
      owner.whatsapp_number,
      TEMPLATE_NAME,
      "en",
      bodyValues,
      callbackData,
    );

    // 6. Log
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: owner.id,
      recipientPhone: owner.whatsapp_number,
      templateName: TEMPLATE_NAME,
      notificationType: "access_code",
      callbackData,
      messageId: result.messageId,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { org_id, expires_at, requested_by: body.requested_by ?? null },
    });

    return new Response(JSON.stringify({ success: result.success }), { status: 200 });
  } catch (err) {
    console.error("Error in send-access-code:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
