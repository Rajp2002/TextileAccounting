// ─── send-yield-alert ─────────────────────────────────────────────────────────
// Event-driven: called from closeYarnBatch() server action when leakage detected.
// Fires once per batch (deduplicated via whatsapp_cooldowns).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendInteraktTemplate,
  logDelivery,
  formatInr,
  getSuratTimeLabel,
  makeCallbackData,
} from "../_shared/interakt.ts";

const TEMPLATE_NAME = "vastra_yield_alert";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { org_id, batch_id } = body;

    if (!org_id || !batch_id) {
      return new Response(JSON.stringify({ error: "Missing org_id or batch_id" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("INTERAKT_API_KEY")!;

    // 1. Deduplication check — one yield alert per batch, ever
    const { data: cooldown } = await supabase
      .from("whatsapp_cooldowns")
      .select("ref_id")
      .eq("org_id", org_id)
      .eq("alert_type", "yield_alert")
      .eq("ref_id", batch_id)
      .maybeSingle();

    if (cooldown) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "yield alert already sent for this batch" }),
        { status: 200 },
      );
    }

    // 2. Fetch owner's WhatsApp number
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

    // 3. Fetch batch + quality details
    const { data: batch, error: batchError } = await supabase
      .from("yarn_batches")
      .select(`
        name,
        total_weight_kg,
        leftover_weight_kg,
        qualities ( name, target_yield, avg_sale_price_per_m )
      `)
      .eq("id", batch_id)
      .eq("org_id", org_id)
      .single();

    if (batchError || !batch) {
      return new Response(JSON.stringify({ error: "Batch not found" }), { status: 404 });
    }

    // 4. Fetch factory name
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const factoryName = org?.name ?? "Your Factory";

    // 5. Calculate efficiency & loss
    const quality = batch.qualities as any;
    const netWeight = Number(batch.total_weight_kg) - Number(batch.leftover_weight_kg ?? 0);
    const expectedMeters = netWeight * Number(quality.target_yield);

    const { data: production } = await supabase
      .from("production_logs")
      .select("meters")
      .eq("yarn_batch_id", batch_id);

    const actualMeters = (production ?? []).reduce((sum: number, r: any) => sum + Number(r.meters), 0);
    const efficiency = expectedMeters > 0
      ? Math.round((actualMeters / expectedMeters) * 100 * 10) / 10
      : 100;
    const lossMeters = Math.max(0, expectedMeters - actualMeters);
    const estimatedLoss = lossMeters * Number(quality.avg_sale_price_per_m);

    // 6. Build template body (7 variables)
    const bodyValues = [
      factoryName,                          // {{1}} Factory name
      getSuratTimeLabel(),                  // {{2}} Time
      batch.name,                           // {{3}} Batch/Beam ID
      quality.name,                         // {{4}} Quality name
      String(Math.round(expectedMeters)),   // {{5}} Expected meters
      String(Math.round(actualMeters)),     // {{6}} Actual meters
      String(efficiency.toFixed(1)),        // {{7}} Efficiency %
      formatInr(estimatedLoss),             // NOTE: template has 7 vars, pack loss into 7th if needed
    ];

    // Adjust to exactly 7 variables (efficiency% + loss₹ in one if template is designed that way)
    // Template vastra_yield_alert uses {{7}} = est. loss in ₹
    const finalBodyValues = bodyValues.slice(0, 7);
    finalBodyValues[6] = `${efficiency.toFixed(1)}% — Est. Loss: ₹${formatInr(estimatedLoss)}`;

    const callbackData = makeCallbackData("yield", org_id);

    // 7. Send
    const result = await sendInteraktTemplate(
      apiKey,
      owner.whatsapp_number,
      TEMPLATE_NAME,
      "en",
      finalBodyValues,
      callbackData,
    );

    // 8. Insert cooldown (deduplication — one per batch close)
    await supabase.from("whatsapp_cooldowns").upsert({
      org_id,
      alert_type: "yield_alert",
      ref_id: batch_id,
      sent_at: new Date().toISOString(),
    });

    // 9. Log
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: owner.id,
      recipientPhone: owner.whatsapp_number,
      templateName: TEMPLATE_NAME,
      notificationType: "yield_alert",
      callbackData,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { bodyValues: finalBodyValues, batch_id, efficiency, estimatedLoss },
    });

    return new Response(JSON.stringify({ success: result.success }), { status: 200 });
  } catch (err) {
    console.error("Error in send-yield-alert:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
