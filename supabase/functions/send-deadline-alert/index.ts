// ─── send-deadline-alert ──────────────────────────────────────────────────────
// Event-driven: called from production log writes (via DailyEntry server action).
// Checks order pace_index and fires vastra_deadline_risk with 24h cooldown per order.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendInteraktTemplate,
  logDelivery,
  makeCallbackData,
} from "../_shared/interakt.ts";

const TEMPLATE_NAME = "vastra_deadline_risk";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { org_id, order_id } = body;

    if (!org_id || !order_id) {
      return new Response(JSON.stringify({ error: "Missing org_id or order_id" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("INTERAKT_API_KEY")!;

    // 1. Fetch current order pace from the order_progress_summary view
    const { data: orderSummary, error: orderError } = await supabase
      .from("order_progress_summary")
      .select("party_name, progress_percent, pace_index, deadline, status")
      .eq("order_id", order_id)
      .eq("org_id", org_id)
      .single();

    if (orderError || !orderSummary) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    }

    // 2. Only fire if order is active and behind pace
    if (orderSummary.status !== "active" || Number(orderSummary.pace_index) >= 1.0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "order on track or not active" }),
        { status: 200 },
      );
    }

    // 3. Check 24h cooldown
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cooldown } = await supabase
      .from("whatsapp_cooldowns")
      .select("sent_at")
      .eq("org_id", org_id)
      .eq("alert_type", "deadline_risk")
      .eq("ref_id", order_id)
      .gt("sent_at", twentyFourHoursAgo)
      .maybeSingle();

    if (cooldown) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "cooldown active (within 24h)" }),
        { status: 200 },
      );
    }

    // 4. Fetch owner's WhatsApp number
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

    // 5. Fetch factory name
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const factoryName = org?.name ?? "Your Factory";

    // 6. Calculate days remaining
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(orderSummary.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );

    // 7. Build template body (5 variables)
    const bodyValues = [
      factoryName,                                          // {{1}} Factory name
      orderSummary.party_name,                              // {{2}} Party/Order name
      String(Math.round(Number(orderSummary.progress_percent))), // {{3}} Progress %
      String(daysRemaining),                                // {{4}} Days remaining
      String(Number(orderSummary.pace_index).toFixed(2)),  // {{5}} Pace index
    ];

    const callbackData = makeCallbackData("deadline", org_id);

    // 8. Send
    const result = await sendInteraktTemplate(
      apiKey,
      owner.whatsapp_number,
      TEMPLATE_NAME,
      "en",
      bodyValues,
      callbackData,
    );

    // 9. Upsert cooldown (reset the 24h window)
    await supabase.from("whatsapp_cooldowns").upsert({
      org_id,
      alert_type: "deadline_risk",
      ref_id: order_id,
      sent_at: new Date().toISOString(),
    });

    // 10. Log
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: owner.id,
      recipientPhone: owner.whatsapp_number,
      templateName: TEMPLATE_NAME,
      notificationType: "deadline_risk",
      callbackData,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { bodyValues, order_id, pace_index: orderSummary.pace_index },
    });

    return new Response(JSON.stringify({ success: result.success }), { status: 200 });
  } catch (err) {
    console.error("Error in send-deadline-alert:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
