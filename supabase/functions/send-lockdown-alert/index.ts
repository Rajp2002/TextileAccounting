// ─── send-lockdown-alert ───────────────────────────────────────────────────────
// Event-driven: called from lockdownTenant() server action.
//
// DESIGN — Compliance Notification:
//   Legally required under DPDP 2026 to notify the Data Fiduciary (Owner) of isolation.
//
// Template: weavly_tenant_lockdown (UTILITY, English, 2 variables)
//   Body: "🚨 *URGENT: Factory Lockdown — {{1}}*\n\nYour factory floor access has been temporarily suspended due to a security or compliance detection.\n\n*Reason:* {{2}}\n*Action:* Platform isolation triggered to protect data integrity.\n\nTo request an unlock, please log in to the Weavly dashboard and use the \"Request Unlock\" button to contact the Grievance Officer.\n\n_Weavly Compliance Detection_"

import {
  sendWhatsAppTemplate,
  logDelivery,
  makeCallbackData,
} from "../_shared/whatsapp.ts";
import {
  createSupabaseAdminClient,
  requireInternalAuthorization,
} from "../_shared/secrets.ts";

const TEMPLATE_NAME = "weavly_tenant_lockdown";

Deno.serve(async (req) => {
  const authError = requireInternalAuthorization(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { org_id, reason, severity } = body;

    if (!org_id || !reason) {
      return new Response(JSON.stringify({ error: "Missing org_id or reason" }), { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN")!;
    const metaPhoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID")!;

    // 1. Fetch owner's details
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
      console.error("[send-lockdown-alert] Database fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database lookup failed" }), { status: 500 });
    }

    if (!owner) {
      console.warn(`[send-lockdown-alert] Skip: No opted-in owner found for org ${org_id}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no opted-in owner with WhatsApp" }),
        { status: 200 },
      );
    }

    // 2. Fetch factory name
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const factoryName = org?.name ?? "Your Factory";

    // 3. Build template variables
    const bodyValues = [
      factoryName, // {{1}} Factory Name
      reason,      // {{2}} Reason for lockdown
    ];

    const callbackData = makeCallbackData("lockdown", org_id);

    // 4. Send template
    const result = await sendWhatsAppTemplate(
      metaAccessToken,
      metaPhoneNumberId,
      owner.whatsapp_number,
      TEMPLATE_NAME,
      "en",
      bodyValues,
      callbackData,
    );

    // 5. Log
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: owner.id,
      recipientPhone: owner.whatsapp_number,
      templateName: TEMPLATE_NAME,
      notificationType: "lockdown_alert",
      callbackData,
      messageId: result.messageId,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { org_id, reason, severity },
    });

    return new Response(JSON.stringify({ success: result.success }), { status: 200 });
  } catch (err) {
    console.error("Error in send-lockdown-alert:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
