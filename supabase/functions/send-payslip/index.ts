// ─── send-payslip ─────────────────────────────────────────────────────────────
// Event-driven: called from toggleWorkerPaid() server action after settlement.
// Sends a personalised payslip to the worker's WhatsApp number via Interakt.
// Multi-machine breakdown is newline-joined into a single template variable.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendWhatsAppTemplate,
  logDelivery,
  formatInr,
  makeCallbackData,
} from "../_shared/whatsapp.ts";

// Template names must match exactly what is approved in Interakt
const TEMPLATES: Record<string, string> = {
  en: "worker_payslips",
  hi: "worker_payslips",   // use same template until hi/gu variants are approved
  gu: "worker_payslips",
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
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN")!;
    const metaPhoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID")!;

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

    const payload = settlement.itemization_payload || {};

    // 2. Fetch factory name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", org_id)
      .single();
    const factoryName = org?.name ?? "Your Factory";

    // 3. Fetch worker info
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

    // 4. Build Itemized Breakdown (For the second message)
    // We use the JSONB snapshot from the settlement to ensure 100% accuracy with what was actually paid.
    let detailMessage = `📋 *Payment Breakdown* (${settlement.month})\n\n`;
    
    // Bonuses
    if (payload.bonuses?.length > 0) {
      detailMessage += `*Earnings:*\n`;
      payload.bonuses.forEach((b: any) => {
        detailMessage += `• ${b.category}: ₹${formatInr(b.amount)}\n`;
      });
      detailMessage += `\n`;
    }

    // Fines
    if (payload.fines?.length > 0) {
      detailMessage += `*Deductions/Fines:*\n`;
      payload.fines.forEach((f: any) => {
        detailMessage += `• ${f.category}: ₹${formatInr(f.amount)}\n`;
      });
      detailMessage += `\n`;
    }

    // Advances Recovered
    if (payload.advances_recovered?.length > 0) {
      detailMessage += `*Advance Recovered:*\n`;
      payload.advances_recovered.forEach((a: any) => {
        // Format date as "15 Apr"
        const dateStr = a.date 
          ? new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) 
          : "";
        
        detailMessage += `• ${dateStr ? dateStr + ': ' : ''}${a.label || 'Upaad'}: ₹${formatInr(a.recovered)}`;
        if (a.carried_forward > 0) {
          detailMessage += ` (Remaining: ₹${formatInr(a.carried_forward)})`;
        }
        detailMessage += `\n`;
      });
      detailMessage += `\n`;
    }

    // Statutory
    if (payload.pf?.employee > 0 || payload.esic?.employee > 0) {
      detailMessage += `*Statutory:*\n`;
      if (payload.pf?.employee > 0) detailMessage += `• PF (Worker): ₹${formatInr(payload.pf.employee)}\n`;
      if (payload.esic?.employee > 0) detailMessage += `• ESI (Worker): ₹${formatInr(payload.esic.employee)}\n`;
      detailMessage += `\n`;
    }

    detailMessage += `*Total Net Paid: ₹${formatInr(settlement.net_payout)}*`;

    // 5. Build Summary Body (Existing Template)
    const monthLabel = new Date(`${settlement.month}-01`).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    const lang = worker.whatsapp_language ?? "en";
    const templateName = TEMPLATES[lang] ?? TEMPLATES["en"];
    const langCode = LANG_CODES[lang] ?? "en";

    // Summary Body Variables (7 total)
    // {{4}} shows a simple summary since details are in message #2
    const summaryBreakdown = worker_type === "meter" 
      ? `Piece-rate production for ${monthLabel}`
      : `Monthly Salary for ${monthLabel}`;

    const bodyValues = [
      factoryName,                                         // {{1}} Factory name
      monthLabel,                                          // {{2}} Month Year
      worker.name,                                         // {{3}} Worker name
      summaryBreakdown,                                    // {{4}} Summary link
      formatInr(Number(settlement.gross_pay)),             // {{5}} Gross earnings
      formatInr(Number(settlement.advance_deducted)),      // {{6}} Advance deducted
      formatInr(Number(settlement.net_payout)),            // {{7}} Net paid
    ];

    const callbackData = makeCallbackData("payslip", org_id);

    // 6. Send Part 1: Summary Template
    const templateResult = await sendWhatsAppTemplate(
      metaAccessToken,
      metaPhoneNumberId,
      worker.whatsapp_number,
      templateName,
      langCode,
      bodyValues,
      callbackData,
    );

    // 7. Send Part 2: Itemized Free-form (Success of #1 is not a hard gate, but logical)
    let freeformResult = { success: false };
    if (templateResult.success) {
      // Small delay to ensure order in the app
      await new Promise(r => setTimeout(r, 500));
      freeformResult = await import("../_shared/whatsapp.ts").then(m => 
        m.sendWhatsAppFreeform(metaAccessToken, metaPhoneNumberId, worker.whatsapp_number, detailMessage)
      );
    }

    // 8. Log delivery (of the main template)
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: null,
      recipientPhone: worker.whatsapp_number,
      templateName,
      notificationType: "payslip_summary",
      callbackData,
      messageId: templateResult.messageId,
      status: templateResult.success ? "sent" : "failed",
      errorMessage: templateResult.success ? null : JSON.stringify(templateResult.responseBody),
      payloadSnapshot: { 
        bodyValues, 
        itemization: payload, 
        settlement_id,
        detail_sent: freeformResult.success
      },
    });

    // 9. If Part 2 failed, log a specific failure entry for owner visibility
    if (templateResult.success && !freeformResult.success) {
      await logDelivery(supabase, {
        orgId: org_id,
        recipientPhone: worker.whatsapp_number,
        templateName: "FREEFORM_TEXT",
        notificationType: "payslip_details_fallback",
        callbackData,
        status: "failed",
        errorMessage: "WhatsApp session window expired (24h). Itemized details not delivered.",
        payloadSnapshot: { detailMessage, settlement_id },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: templateResult.success, 
        detail_sent: freeformResult.success,
        worker: worker.name 
      }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Error in send-payslip:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
