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

const TEMPLATE_NORMAL = "vastra_daily_brief_normal";
const TEMPLATE_ALERT = "vastra_daily_brief_alert";
const TEMPLATE_DEADLINE = "vastra_deadline_risk";
const LEAKAGE_THRESHOLD = Number(Deno.env.get("LEAKAGE_ALERT_THRESHOLD") ?? "5");

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

  // 2. Get today's stats via RPC
  const { data: statsData, error: statsError } = await supabase.rpc(
    "get_daily_brief_stats",
    { p_org_id: orgId, p_date: todayStr },
  );

  const stats = (!statsError && statsData)
    ? statsData
    : { total_meters: 0, active_orders: 0, avg_efficiency: 100, estimated_loss_inr: 0, piece_rate_wages: 0 };

  if (statsError) console.warn(`Stats fetch failed for org ${orgId}: ${statsError.message}`);

  // 3. Pick template based on leakage threshold
  const hasLeakage = Number(stats.avg_efficiency) < (100 - LEAKAGE_THRESHOLD);
  const callbackData = makeCallbackData("brief", orgId);

  let templateName: string;
  let bodyValues: string[];

  if (hasLeakage) {
    templateName = TEMPLATE_ALERT;
    bodyValues = [
      factoryName,
      dateLabel,
      String(Math.round(Number(stats.total_meters))),
      String(stats.active_orders),
      String(Number(stats.avg_efficiency).toFixed(1)),
      formatInr(Number(stats.estimated_loss_inr)),
      formatInr(Number(stats.piece_rate_wages)),
    ];
  } else {
    templateName = TEMPLATE_NORMAL;
    bodyValues = [
      factoryName,
      dateLabel,
      String(Math.round(Number(stats.total_meters))),
      String(stats.active_orders),
      String(Number(stats.avg_efficiency).toFixed(1)),
      formatInr(Number(stats.piece_rate_wages)),
    ];
  }

  // 4. Send daily brief
  const result = await sendInteraktTemplate(apiKey, phone, templateName, "en", bodyValues, callbackData);

  await logDelivery(supabase, {
    orgId,
    ownerProfileId,
    recipientPhone: phone,
    templateName,
    notificationType: "daily_brief",
    callbackData,
    status: result.success ? "sent" : "failed",
    errorMessage: result.success ? null : JSON.stringify(result.responseBody),
    payloadSnapshot: { bodyValues, template: templateName },
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
    .select("order_id, party_name, total_target_meters, progress_percent, pace_index, deadline")
    .eq("org_id", orgId)
    .eq("status", "active")
    .lt("pace_index", 1.0);

  if (!orders?.length) return;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const order of orders) {
    // Check cooldown
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

    const result = await sendInteraktTemplate(apiKey, phone, TEMPLATE_DEADLINE, "en", [
      factoryName,
      order.party_name,
      String(Math.round(Number(order.progress_percent))),
      String(Math.max(0, daysRemaining)),
      String(Number(order.pace_index).toFixed(2)),
    ], callbackData);

    // Upsert cooldown (replace old entry)
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
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { order_id: order.order_id, party: order.party_name },
    });
  }
}
