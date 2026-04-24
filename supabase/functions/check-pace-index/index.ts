// ─── check-pace-index ─────────────────────────────────────────────────────────
// Scheduled by pg_cron every 6 hours (0 */6 * * *).
// Scans ALL active orders across ALL orgs that have pace_index < 1.0
// and fires the weavly_deadline_risk WhatsApp alert with a 24-hour cooldown.
//
// This is a companion to send-daily-brief's inline deadline check —
// it fills the gaps between the nightly brief (20:00 IST) so that
// orders falling behind pace are flagged within 6 hours, not 24.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendWhatsAppTemplate,
  logDelivery,
  makeCallbackData,
} from "../_shared/whatsapp.ts";

const TEMPLATE_NAME = "weavly_deadline_risk";

Deno.serve(async (req) => {
  // Only service_role (pg_cron) may call this.
  // The cron passes Authorization: Bearer <service_role_key>.
  // Public callers are rejected.
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN")!;
    const metaPhoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID")!;

    const results: { org_id: string; order_id: string; outcome: string }[] = [];

    // 1. Fetch ALL active orders globally where pace_index < 1.0
    //    order_progress_summary is a view with no RLS (service_role bypasses anyway).
    const { data: behindOrders, error: ordersError } = await supabase
      .from("order_progress_summary")
      .select("order_id, org_id, party_name, progress_percent, pace_index, deadline")
      .eq("status", "active")
      .lt("pace_index", 1.0);

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    if (!behindOrders?.length) {
      return new Response(
        JSON.stringify({ checked: 0, sent: 0, message: "All active orders on track" }),
        { status: 200 },
      );
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const order of behindOrders) {
      const { org_id, order_id } = order;

      // 2. Check 24h cooldown per-order to avoid spam
      const { data: cooldown } = await supabase
        .from("whatsapp_cooldowns")
        .select("sent_at")
        .eq("org_id", org_id)
        .eq("alert_type", "deadline_risk")
        .eq("ref_id", order_id)
        .gt("sent_at", twentyFourHoursAgo)
        .maybeSingle();

      if (cooldown) {
        results.push({ org_id, order_id, outcome: "cooldown" });
        continue;
      }

      // 3. Fetch org's opted-in owner
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
        results.push({ org_id, order_id, outcome: "no_opted_in_owner" });
        continue;
      }

      // 4. Fetch factory name
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", org_id)
        .single();
      const factoryName = org?.name ?? "Your Factory";

      // 5. Days remaining until deadline
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (new Date(order.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      );

      const bodyValues = [
        factoryName,                                                    // {{1}} Factory name
        order.party_name,                                               // {{2}} Party/Order
        String(Math.round(Number(order.progress_percent))),             // {{3}} Progress %
        String(daysRemaining),                                          // {{4}} Days remaining
        String(Number(order.pace_index).toFixed(2)),                    // {{5}} Pace index
      ];

      const callbackData = makeCallbackData("pace_check", org_id);

      // 6. Send alert
      const result = await sendWhatsAppTemplate(
        metaAccessToken,
        metaPhoneNumberId,
        owner.whatsapp_number,
        TEMPLATE_NAME,
        "en",
        bodyValues,
        callbackData,
      );

      // 7. Upsert cooldown (resets the 24h window regardless of send outcome)
      await supabase.from("whatsapp_cooldowns").upsert({
        org_id,
        alert_type: "deadline_risk",
        ref_id: order_id,
        sent_at: new Date().toISOString(),
      });

      // 8. Log delivery
      await logDelivery(supabase, {
        orgId: org_id,
        ownerProfileId: owner.id,
        recipientPhone: owner.whatsapp_number,
        templateName: TEMPLATE_NAME,
        notificationType: "deadline_risk",
        callbackData,
        messageId: result.messageId,
        status: result.success ? "sent" : "failed",
        errorMessage: result.success ? null : JSON.stringify(result.responseBody),
        payloadSnapshot: {
          order_id,
          party_name: order.party_name,
          pace_index: order.pace_index,
          bodyValues,
          source: "check-pace-index",
        },
      });

      results.push({ org_id, order_id, outcome: result.success ? "sent" : "failed" });
    }

    const sent = results.filter((r) => r.outcome === "sent").length;
    const failed = results.filter((r) => r.outcome === "failed").length;
    const skipped = results.filter((r) => ["cooldown", "no_opted_in_owner"].includes(r.outcome)).length;

    console.log(`check-pace-index — checked: ${behindOrders.length}, sent: ${sent}, failed: ${failed}, skipped: ${skipped}`);

    return new Response(
      JSON.stringify({ checked: behindOrders.length, sent, failed, skipped, results }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Fatal error in check-pace-index:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
