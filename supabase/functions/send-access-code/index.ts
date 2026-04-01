// ─── send-access-code ─────────────────────────────────────────────────────────
// Event-driven: called from generateAccessCode() server action after saving hash.
// Delivers the 6-character access code to the owner's WhatsApp — enables
// off-site owners to forward the code to their supervisor securely.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendInteraktTemplate,
  logDelivery,
  getSuratTimeLabel,
  makeCallbackData,
} from "../_shared/interakt.ts";

const TEMPLATE_NAME = "vastra_access_code";

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
    const apiKey = Deno.env.get("INTERAKT_API_KEY")!;

    // 1. Fetch owner's details
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, whatsapp_number, whatsapp_opted_in")
      .eq("org_id", org_id)
      .eq("role", "owner")
      .not("whatsapp_number", "is", null)
      .limit(1)
      .maybeSingle();

    if (!owner?.whatsapp_number || !owner.whatsapp_opted_in) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no opted-in owner with WhatsApp" }),
        { status: 200 },
      );
    }

    // 2. Fetch factory name
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const factoryName = org?.name ?? "Your Factory";

    // 3. Format expiry label
    const expiresLabel = expires_at
      ? `Expires at ${new Date(expires_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}`
      : "Valid for 15 minutes";

    // 4. Build template body (Authentication template, 4 variables)
    const bodyValues = [
      factoryName,         // {{1}} Factory name
      getSuratTimeLabel(), // {{2}} Time of generation
      code,                // {{3}} The 6-char access code (shown in bold in template)
      expiresLabel,        // {{4}} Expiry info
    ];

    const callbackData = makeCallbackData("accesscode", org_id);

    // 5. Send — no cooldown for security codes, every request fires
    const result = await sendInteraktTemplate(
      apiKey,
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
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      // NOTE: We do NOT log the plaintext code in the payload_snapshot for security
      payloadSnapshot: { org_id, expires_at, variables_count: bodyValues.length },
    });

    return new Response(JSON.stringify({ success: result.success }), { status: 200 });
  } catch (err) {
    console.error("Error in send-access-code:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
