// ─── send-payslip ─────────────────────────────────────────────────────────────
// Event-driven: called from settlePayrollAndNotify() server action.
// Sends a personalised payslip to the worker's WhatsApp number.
// Multi-machine breakdown is newline-joined into a single template variable.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendInteraktTemplate,
  logDelivery,
  formatInr,
  getSuratDateLabel,
  makeCallbackData,
} from "../_shared/interakt.ts";

// Template names must match exactly what was approved in Interakt
const TEMPLATES: Record<string, string> = {
  en: "vastra_payslip_en",
  hi: "vastra_payslip_hi",
  gu: "vastra_payslip_gu",
};

// Language codes for Interakt API
const LANG_CODES: Record<string, string> = {
  en: "en",
  hi: "hi",
  gu: "gu",
};

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { org_id, worker_id, worker_type, settlement_id } = body;

    if (!org_id || !worker_id || !worker_type || !settlement_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("INTERAKT_API_KEY")!;

    // 1. Fetch the payroll settlement record
    const { data: settlement, error: settlementError } = await supabase
      .from("payroll_settlements")
      .select("*")
      .eq("id", settlement_id)
      .eq("org_id", org_id)
      .single();

    if (settlementError || !settlement) {
      return new Response(JSON.stringify({ error: "Settlement not found" }), { status: 404 });
    }

    // 2. Fetch factory name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", org_id)
      .single();
    const factoryName = org?.name ?? "Your Factory";

    // 3. Fetch worker info (name, WhatsApp number, language)
    const workerTable = worker_type === "meter" ? "workers" : "fixed_workers";
    const { data: worker, error: workerError } = await supabase
      .from(workerTable)
      .select("name, whatsapp_number, whatsapp_language")
      .eq("id", worker_id)
      .eq("org_id", org_id)
      .single();

    if (workerError || !worker?.whatsapp_number) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "worker has no WhatsApp number" }),
        { status: 200 },
      );
    }

    // 4. Build machine breakdown for piece-rate workers
    let machineBreakdown = "";
    if (worker_type === "meter") {
      // Fetch production logs for the settlement month
      const monthStart = `${settlement.month}-01`;
      const monthEnd = new Date(
        Number(settlement.month.split("-")[0]),
        Number(settlement.month.split("-")[1]),
        0,
      ).toISOString().split("T")[0]; // last day of month

      const { data: logs } = await supabase
        .from("production_logs")
        .select(`
          meters,
          machines ( name ),
          workers ( rate_per_meter )
        `)
        .eq("org_id", org_id)
        .eq("worker_id", worker_id)
        .gte("date", monthStart)
        .lte("date", monthEnd);

      // Group by machine name
      const machineMap: Record<string, { meters: number; rate: number }> = {};
      for (const log of logs ?? []) {
        const machineName = (log.machines as any)?.name ?? "Machine";
        const rate = Number((log.workers as any)?.rate_per_meter ?? 0);
        if (!machineMap[machineName]) machineMap[machineName] = { meters: 0, rate };
        machineMap[machineName].meters += Number(log.meters);
      }

      // Newline-joined breakdown: "Machine A — 1,200m @ ₹2.50 = ₹3,000"
      machineBreakdown = Object.entries(machineMap)
        .map(([name, { meters, rate }]) =>
          `${name} — ${Math.round(meters)}m @ ₹${rate.toFixed(2)} = ₹${formatInr(meters * rate)}`
        )
        .join("\n");

      if (!machineBreakdown) machineBreakdown = "—";
    } else {
      // Fixed worker: show salary details
      machineBreakdown = `Monthly salary`;
    }

    // 5. Format month label (e.g. "March 2026")
    const [year, month] = settlement.month.split("-");
    const monthLabel = new Date(`${year}-${month}-01`).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    // 6. Build body values (7 variables for payslip template)
    const lang = worker.whatsapp_language ?? "en";
    const templateName = 'worker_payslips';
    const langCode = LANG_CODES[lang] ?? "en";

    const bodyValues = [
      factoryName,                            // {{1}} Factory name
      monthLabel,                             // {{2}} Month Year
      worker.name,                            // {{3}} Worker name
      machineBreakdown,                       // {{4}} Production breakdown (newline-joined)
      formatInr(Number(settlement.gross_pay)), // {{5}} Gross earnings
      formatInr(Number(settlement.advance_deducted)), // {{6}} Advance deducted
      formatInr(Number(settlement.net_payout)),       // {{7}} Net paid
    ];

    const callbackData = makeCallbackData("payslip", org_id);

    // 7. Send to Interakt
    const result = await sendInteraktTemplate(
      apiKey,
      worker.whatsapp_number,
      templateName,
      langCode,
      bodyValues,
      callbackData,
    );

    // 8. Log delivery
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: null, // worker-facing message
      recipientPhone: worker.whatsapp_number,
      templateName,
      notificationType: "payslip",
      callbackData,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { bodyValues, worker_id, settlement_id },
    });

    return new Response(
      JSON.stringify({ success: result.success, worker: worker.name }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Error in send-payslip:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
