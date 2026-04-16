// ─── retry-failed-messages ────────────────────────────────────────────────────
// Scheduled by pg_cron every hour (0 * * * *).
// Finds whatsapp_delivery_log rows where:
//   • status = 'failed'
//   • sent_at > NOW() - 24h  (don't retry stale/archived failures)
//   • retry_count < 3        (hard cap — 3 retries over 24h max)
//
// For each row, re-sends the original template using the stored payload_snapshot
// (bodyValues, template_name, recipient_phone) — no DB re-fetch needed.
//
// On success: status → 'sent', retry_count++, last_retry_at = NOW()
// On failure: retry_count++, last_retry_at = NOW(), status stays 'failed'
//
// The delivery log row is UPDATED (not inserted) so the audit trail
// shows the full retry history via retry_count + last_retry_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
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

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Find retryable failed rows
    const { data: failures, error: fetchError } = await supabase
      .from("whatsapp_delivery_log")
      .select("id, recipient_phone, template_name, meta_callback_data, payload_snapshot, retry_count")
      .eq("status", "failed")
      .gt("sent_at", cutoff)
      .lt("retry_count", 3)
      .order("sent_at", { ascending: true })
      .limit(50); // Safety cap: max 50 retries per run

    if (fetchError) {
      throw new Error(`Failed to fetch retryable rows: ${fetchError.message}`);
    }

    if (!failures?.length) {
      return new Response(
        JSON.stringify({ retried: 0, message: "No retryable failures found" }),
        { status: 200 },
      );
    }

    const outcomes: { id: string; outcome: "recovered" | "failed_again" | "error" }[] = [];

    for (const row of failures) {
      const snapshot = row.payload_snapshot as {
        bodyValues?: string[];
        languageCode?: string;
      } | null;

      if (!snapshot?.bodyValues) {
        // Payload snapshot missing — cannot retry, bump count so we don't keep trying
        await supabase
          .from("whatsapp_delivery_log")
          .update({
            retry_count: (row.retry_count ?? 0) + 1,
            last_retry_at: new Date().toISOString(),
            error_message: "retry_skipped: no bodyValues in payload_snapshot",
          })
          .eq("id", row.id);
        outcomes.push({ id: row.id, outcome: "error" });
        continue;
      }

      let result;
      try {
        result = await sendWhatsAppTemplate(
          metaAccessToken,
          metaPhoneNumberId,
          row.recipient_phone,
          row.template_name,
          snapshot.languageCode ?? "en",
          snapshot.bodyValues,
          row.meta_callback_data ?? `retry_${row.id}`,
        );
      } catch (sendErr) {
        // Network-level failure — still increment retry_count
        await supabase
          .from("whatsapp_delivery_log")
          .update({
            retry_count: (row.retry_count ?? 0) + 1,
            last_retry_at: new Date().toISOString(),
            error_message: `retry fetch error: ${String(sendErr)}`,
          })
          .eq("id", row.id);
        outcomes.push({ id: row.id, outcome: "failed_again" });
        continue;
      }

      // Update row with retry outcome
      await supabase
        .from("whatsapp_delivery_log")
        .update({
          status: result.success ? "sent" : "failed",
          retry_count: (row.retry_count ?? 0) + 1,
          last_retry_at: new Date().toISOString(),
          meta_message_id: result.messageId ?? undefined,
          error_message: result.success
            ? null
            : `retry_${(row.retry_count ?? 0) + 1}: ${JSON.stringify(result.responseBody)}`,
        })
        .eq("id", row.id);

      outcomes.push({ id: row.id, outcome: result.success ? "recovered" : "failed_again" });
    }

    const recovered = outcomes.filter((o) => o.outcome === "recovered").length;
    const failedAgain = outcomes.filter((o) => o.outcome === "failed_again").length;
    const errors = outcomes.filter((o) => o.outcome === "error").length;

    console.log(`retry-failed-messages — total: ${failures.length}, recovered: ${recovered}, failed_again: ${failedAgain}, errors: ${errors}`);

    return new Response(
      JSON.stringify({ total: failures.length, recovered, failed_again: failedAgain, errors }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Fatal error in retry-failed-messages:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
