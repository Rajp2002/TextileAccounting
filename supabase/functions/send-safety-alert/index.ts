// ─── send-safety-alert ────────────────────────────────────────────────────────
// Event-driven: called when an incident with severity = 'critical' is created.
// No cooldown — every critical incident fires immediately regardless of frequency.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendInteraktTemplate,
  logDelivery,
  getSuratDateLabel,
  makeCallbackData,
} from "../_shared/interakt.ts";

const TEMPLATE_NAME = "vastra_safety_incident";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { org_id, incident_id } = body;

    if (!org_id || !incident_id) {
      return new Response(JSON.stringify({ error: "Missing org_id or incident_id" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("INTERAKT_API_KEY")!;

    // 1. Fetch owner's WhatsApp number
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, whatsapp_number")
      .eq("org_id", org_id)
      .eq("role", "owner")
      .eq("whatsapp_opted_in", true)
      .not("whatsapp_number", "is", null)
      .limit(1)
      .maybeSingle();

    if (!owner?.whatsapp_number) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no opted-in owner with WhatsApp" }),
        { status: 200 },
      );
    }

    // 2. Fetch incident details (with related worker name if any)
    const { data: incident, error: incError } = await supabase
      .from("incidents")
      .select(`
        title,
        date,
        severity,
        description,
        workers ( name )
      `)
      .eq("id", incident_id)
      .eq("org_id", org_id)
      .single();

    if (incError || !incident) {
      return new Response(JSON.stringify({ error: "Incident not found" }), { status: 404 });
    }

    // 3. Fetch factory name
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const factoryName = org?.name ?? "Your Factory";

    const workerName = (incident.workers as any)?.name ?? "Not specified";

    // 4. Build template body (5 variables)
    const bodyValues = [
      factoryName,                           // {{1}} Factory name
      getSuratDateLabel(),                   // {{2}} Date
      incident.title,                        // {{3}} Incident title
      incident.severity.toUpperCase(),       // {{4}} Severity (CRITICAL)
      workerName,                            // {{5}} Worker involved
    ];

    const callbackData = makeCallbackData("safety", org_id);

    // 5. Send — no cooldown, every critical incident fires
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
      notificationType: "safety_incident",
      callbackData,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { bodyValues, incident_id },
    });

    return new Response(JSON.stringify({ success: result.success }), { status: 200 });
  } catch (err) {
    console.error("Error in send-safety-alert:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
