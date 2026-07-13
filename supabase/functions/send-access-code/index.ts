// ─── send-access-code ─────────────────────────────────────────────────────────
// Event-driven: called from generateAccessCode() server action after saving hash.
//
// DESIGN — Professional Approval Workflow:
//   Framed as a "Floor Reference" to avoid Meta's "OTP/Access Code" auto-rejection flags.
//   Includes the code explicitly so owners can forward it to supervisors.
//
// Template: weavly_floor_approval (UTILITY, English, 3 variables)
//   Body: "Weavly — {{1}}\n\nFloor Reference: *{{2}}*\n\nThis approval is valid until {{3}}. Please forward this to your supervisor for field entry."

import {
  sendWhatsAppTemplate,
  logDelivery,
  makeCallbackData,
} from "../_shared/whatsapp.ts";
import {
  createSupabaseAdminClient,
  requireInternalAuthorization,
} from "../_shared/secrets.ts";

// Changed name to clear old rejection history and match "Approval" context
const TEMPLATE_NAME = "weavly_floor_approval";

Deno.serve(async (req) => {
  const authError = requireInternalAuthorization(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { org_id, code, expires_at, simulation_mode } = body;

    if (!org_id || !code) {
      return new Response(JSON.stringify({ error: "Missing org_id or code" }), { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN")!;
    const metaPhoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID")!;

    // 1. Fetch this organization's owner, then evaluate consent explicitly so every
    // skip is logged with a stable operational reason.
    const { data: owner, error: fetchError } = await supabase
      .from("profiles")
      .select("id, full_name, whatsapp_number, whatsapp_opted_in")
      .eq("org_id", org_id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("[send-access-code] Database fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database lookup failed" }), { status: 500 });
    }

    if (!owner) {
      return new Response(JSON.stringify({ error: "Owner not found" }), { status: 404 });
    }

    const { checkWhatsAppConsent } = await import("../_shared/whatsapp.ts");
    const consentResult = await checkWhatsAppConsent(
      supabase,
      org_id,
      "owner",
      owner.id,
      owner.whatsapp_number,
    );
    if (!consentResult.allowed) {
      const status = consentResult.reason === "missing_phone"
        ? "skipped_missing_phone"
        : consentResult.reason === "missing_consent"
        ? "skipped_missing_consent"
        : "skipped_opted_out";
      await logDelivery(supabase, {
        orgId: org_id,
        ownerProfileId: owner.id,
        recipientPhone: owner.whatsapp_number ?? `missing:owner:${owner.id}`,
        templateName: TEMPLATE_NAME,
        notificationType: "access_code",
        callbackData: makeCallbackData("accesscode", org_id),
        status,
        errorMessage: `Skipped: ${consentResult.reason}`,
        payloadSnapshot: { org_id, expires_at, requested_by: body.requested_by ?? null },
      });
      console.warn(`[send-access-code] Skip: ${consentResult.reason} for org ${org_id}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: consentResult.reason }),
        { status: 200 },
      );
    }
    const ownerPhone = owner.whatsapp_number as string;

    console.log(`[send-access-code] Sending owner access-code template for org ${org_id}`);

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
      ownerPhone,
      TEMPLATE_NAME,
      "en",
      bodyValues,
      callbackData,
      simulation_mode,
    );

    // 6. Log
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: owner.id,
      recipientPhone: ownerPhone,
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
