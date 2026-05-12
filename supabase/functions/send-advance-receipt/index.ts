// ─── send-advance-receipt ─────────────────────────────────────────────────────
// Event-driven: called after a worker advance is recorded.
// Sends a timestamped receipt + running balance to the worker's WhatsApp.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendWhatsAppTemplate,
  logDelivery,
  formatInr,
  getSuratDateLabel,
  makeCallbackData,
} from "../_shared/whatsapp.ts";

const TEMPLATE_NAME = "weavly_advance_receipt";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { org_id, advance_id, worker_id, worker_type } = body;

    if (!org_id || !advance_id || !worker_id || !worker_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const metaAccessToken = Deno.env.get("META_WHATSAPP_TOKEN") ?? Deno.env.get("META_ACCESS_TOKEN");
    const metaPhoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID") ?? Deno.env.get("META_PHONE_NUMBER_ID");

    // 1. Fetch factory name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", org_id)
      .single();
    const factoryName = org?.name ?? "Your Factory";

    // 2. Fetch the advance record
    const { data: advance, error: advError } = await supabase
      .from("worker_advances")
      .select("amount, description, created_at")
      .eq("id", advance_id)
      .eq("org_id", org_id)
      .single();

    if (advError || !advance) {
      return new Response(JSON.stringify({ error: "Advance not found" }), { status: 404 });
    }

    // 3. Fetch worker info
    const workerTable = worker_type === "meter" ? "workers" : "fixed_workers";
    const { data: worker } = await supabase
      .from(workerTable)
      .select("name, whatsapp_number, whatsapp_language")
      .eq("id", worker_id)
      .eq("org_id", org_id)
      .single();

    if (!worker?.whatsapp_number) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "worker has no WhatsApp number" }),
        { status: 200 },
      );
    }

    // 3.5 Check Consent
    const { checkWhatsAppConsent } = await import("../_shared/whatsapp.ts");
    const consentResult = await checkWhatsAppConsent(
      supabase,
      org_id,
      'worker',
      worker_id,
      worker.whatsapp_number
    );

    if (!consentResult.allowed) {
      await logDelivery(supabase, {
        orgId: org_id,
        recipientPhone: worker.whatsapp_number,
        templateName: TEMPLATE_NAME,
        notificationType: "advance_receipt",
        callbackData: makeCallbackData("advance", org_id),
        status: `skipped_${consentResult.reason}` as "skipped_opted_out" | "skipped_missing_consent" | "skipped_missing_phone",
        errorMessage: `Skipped: ${consentResult.reason}`,
        payloadSnapshot: { worker_id, advance_id },
      });

      return new Response(
        JSON.stringify({ skipped: true, reason: consentResult.reason }),
        { status: 200 },
      );
    }

    // 4. Calculate total running pending balance (all pending advances for this worker)
    const idField = worker_type === "meter" ? "meter_worker_id" : "fixed_worker_id";
    const { data: pendingAdvances } = await supabase
      .from("worker_advances")
      .select("amount")
      .eq("org_id", org_id)
      .eq(idField, worker_id)
      .eq("status", "pending");

    const runningBalance = (pendingAdvances ?? []).reduce(
      (sum: number, a: any) => sum + Number(a.amount),
      0,
    );

    // 5. Build template body
    const bodyValues = [
      factoryName,                              // {{1}} Factory name
      getSuratDateLabel(),                      // {{2}} Date
      worker.name,                              // {{3}} Worker name
      formatInr(Number(advance.amount)),        // {{4}} Amount issued
      advance.description ?? "General",        // {{5}} Reason
      formatInr(runningBalance),                // {{6}} Running balance (all pending advances)
    ];

    const callbackData = makeCallbackData("advance", org_id);

    // 6. Send — use worker's language preference
    const langCode = (worker as any).whatsapp_language ?? "en";
    const result = await sendWhatsAppTemplate(
      metaAccessToken,
      metaPhoneNumberId,
      worker.whatsapp_number,
      TEMPLATE_NAME,
      langCode,
      bodyValues,
      callbackData,
    );

    // 7. Log
    await logDelivery(supabase, {
      orgId: org_id,
      ownerProfileId: null,
      recipientPhone: worker.whatsapp_number,
      templateName: TEMPLATE_NAME,
      notificationType: "advance_receipt",
      callbackData,
      messageId: result.messageId,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : JSON.stringify(result.responseBody),
      payloadSnapshot: { bodyValues, advance_id, worker_id },
    });

    return new Response(
      JSON.stringify({ success: result.success, worker: worker.name, balance: runningBalance }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Error in send-advance-receipt:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
