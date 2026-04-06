// ─── send-daily-brief ─────────────────────────────────────────────────────────
// Scheduled by pg_cron at 20:00 IST (14:30 UTC) daily.
// Sends Vastra Daily Brief WhatsApp to all opted-in owners.
// Also checks active orders pace_index and sends deadline risk alerts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendInteraktTemplate,
  logDelivery,
  formatInr,
  getSuratDateLabel,
  getSuratTodayString,
  makeCallbackData,
} from "../_shared/interakt.ts";

const TEMPLATE_PIVOT_BRIEF = "vastra_daily_brief_v2";
const TEMPLATE_DEADLINE = "vastra_deadline_risk";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("INTERAKT_API_KEY")!;
    const todayStr = getSuratTodayString();
    const dateLabel = getSuratDateLabel();

    // 1. Fetch all opted-in owners
    const { data: owners, error: ownersError } = await supabase
      .from("profiles")
      .select(`id, whatsapp_number, org_id, organizations ( name )`)
      .eq("role", "owner")
      .eq("whatsapp_opted_in", true)
      .not("whatsapp_number", "is", null);

    if (ownersError) throw new Error(`Owners fetch failed: ${ownersError.message}`);
    if (!owners?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No opted-in owners" }), { status: 200 });
    }

    const results = await Promise.allSettled(
      owners.map((owner) => processOwner(owner, supabase, apiKey, todayStr, dateLabel)),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Daily brief done — Sent: ${sent}, Failed: ${failed}`);
    return new Response(JSON.stringify({ sent, failed }), { status: 200 });
  } catch (err) {
    console.error("Fatal error in send-daily-brief:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

async function processOwner(
  owner: any,
  supabase: any,
  apiKey: string,
  todayStr: string,
  dateLabel: string,
) {
  const orgId = owner.org_id;
  const factoryName = owner.organizations?.name ?? "Your Factory";
  const phone = owner.whatsapp_number as string;
  const ownerProfileId = owner.id as string;

  // 2. Postgres RPC will be updated to return this flat structure.
  // We expect: total_meters, active_orders (count), top_machine_name, top_machine_meters, labor_liability_inr
  const { data: statsData, error: statsError } = await supabase.rpc(
    "get_daily_brief_stats_v2",
    { p_org_id: orgId, p_date: todayStr },
  );

  // ✅ FIX: RPC returns a table (array), unwrap first row
  const stats = (!statsError && statsData?.[0])
    ? statsData[0]
    : { total_meters: 0, active_orders: 0, top_machine_name: 'None', top_machine_meters: 0, labor_liability_inr: 0 };

  if (statsError) console.warn(`Stats fetch failed for org ${orgId}: ${statsError.message}`);

  const callbackData = makeCallbackData("brief", orgId);

  // New Template mapping:
  // {{1}} = Date (e.g. 10 Apr)
  // {{2}} = Total Meters
  // {{3}} = Active Orders Count
  // {{4}} = Top Machine Name
  // {{5}} = Top Machine Meters
  // {{6}} = Total Labor Liability
  const bodyValues = [
    dateLabel,
    String(Math.round(Number(stats.total_meters))),
    String(stats.active_orders),
    stats.top_machine_name || 'N/A',
    String(Math.round(Number(stats.top_machine_meters))),
    formatInr(Number(stats.labor_liability_inr)),
  ];

  // 4. Send daily brief
  const result = await sendInteraktTemplate(apiKey, phone, TEMPLATE_PIVOT_BRIEF, "en", bodyValues, callbackData);

  await logDelivery(supabase, {
    orgId,
    ownerProfileId,
    recipientPhone: phone,
    templateName: TEMPLATE_PIVOT_BRIEF,
    notificationType: "daily_brief",
    callbackData,
    interaktMessageId: result.interaktMessageId,
    status: result.success ? "sent" : "failed",
    errorMessage: result.success ? null : JSON.stringify(result.responseBody),
    payloadSnapshot: { bodyValues, template: TEMPLATE_PIVOT_BRIEF },
  });

  if (!result.success) {
    throw new Error(`Interakt error for org ${orgId}: ${JSON.stringify(result.responseBody)}`);
  }

  // 5. Check active orders pace and send deadline risk alerts
  await checkAndSendDeadlineAlerts(supabase, apiKey, orgId, ownerProfileId, phone, factoryName);
}

async function checkAndSendDeadlineAlerts(
  supabase: any,
  apiKey: string,
  orgId: string,
  ownerProfileId: string,
  phone: string,
  factoryName: string,
) {
  const { data: orders } = await supabase
    .from("order_progress_summary")
    .select("order_id, party_name, quality_label, total_target_meters, progress_percent, pace_index, deadline")
    .eq("org_id", orgId)
    .eq("status", "active")
    .lt("pace_index", 1.0);

  if (!orders?.length) return;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const order of orders) {
    const { data: cooldown } = await supabase
      .from("whatsapp_cooldowns")
      .select("sent_at")
      .eq("org_id", orgId)
      .eq("alert_type", "deadline_risk")
      .eq("ref_id", order.order_id)
      .gt("sent_at", twentyFourHoursAgo)
      .maybeSingle();

    if (cooldown) continue; // Already sent within 24h

    const daysRemaining = Math.ceil(
      (new Date(order.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const callbackData = makeCallbackData("deadline", orgId);

    // Using quality_label fallback because of flat structure
    const orderName = order.quality_label || order.party_name;

    const result = await sendInteraktTemplate(apiKey, phone, TEMPLATE_DEADLINE, "en", [
      factoryName,
      orderName,
      String(Math.round(Number(order.progress_percent))),
      String(Math.max(0, daysRemaining)),
      String(Number(order.pace_index).toFixed(2)),
    ], callbackData);

    await supabase.from("whatsapp_cooldowns").upsert({
      org_id: orgId,
      alert_type: "deadline_risk",
      ref_id: order.order_id,
      sent_at: new Date().toISOString(),
    });

    await logDelivery(supabase, {
      orgId,
      ownerProfileId,
      recipientPhone: phone,
      templateName: TEMPLATE_DEADLINE,
      notificationType: "deadline_risk",
      callbackData,
      interaktMessageId: result.interaktMessageId,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { order_id: order.order_id, party: order.party_name },
    });
  }
}
