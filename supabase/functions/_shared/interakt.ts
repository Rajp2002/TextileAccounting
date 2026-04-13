// ─── Shared Interakt WhatsApp Utility ─────────────────────────────────────────
// Used by all send-* edge functions. Import with:
//   import { sendInteraktTemplate, logDelivery, formatInr, getSuratDateLabel, getSuratTodayString } from "../_shared/interakt.ts";

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const INTERAKT_API = "https://api.interakt.ai/v1/public/message/";
export const COUNTRY_CODE = "+91";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InteraktResult {
  success: boolean;
  responseBody: Record<string, unknown>;
  httpStatus: number;
  /** Message ID returned by Interakt — persisted to whatsapp_delivery_log for webhook correlation */
  interaktMessageId: string | null;
}

export interface LogDeliveryParams {
  orgId: string;
  ownerProfileId?: string | null;
  recipientPhone: string;
  templateName: string;
  notificationType: string;
  callbackData: string;
  status: "sent" | "failed";
  errorMessage?: string | null;
  payloadSnapshot: Record<string, unknown>;
  /** Interakt's message ID from the send response — used as webhook correlation key */
  interaktMessageId?: string | null;
}

// ─── Core Send Function ───────────────────────────────────────────────────────

/**
 * Sends a WhatsApp template message via Interakt API.
 * Returns result including parsed response body for logging.
 */
export async function sendInteraktTemplate(
  apiKey: string,
  phone: string,
  templateName: string,
  languageCode: string = "en",
  bodyValues: string[],
  callbackData: string,
): Promise<InteraktResult> {
  const payload = {
    countryCode: COUNTRY_CODE,
    phoneNumber: phone,
    callbackData,
    type: "Template",
    template: {
      name: templateName,
      languageCode,
      bodyValues,
    },
  };

  let responseBody: Record<string, unknown> = {};
  let httpStatus = 0;

    // Support for provider simulation (testing mode)
    const provider = Deno.env.get("WHATSAPP_PROVIDER") || "interakt";
    if (provider === "simulate") {
      console.log(`[SIMULATE] WhatsApp to ${phone}: ${templateName}`);
      return { 
        success: true, 
        responseBody: { simulated: true }, 
        httpStatus: 200, 
        interaktMessageId: `sim_${Date.now()}` 
      };
    }

    const res = await fetch(INTERAKT_API, {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    httpStatus = res.status;
    responseBody = await res.json().catch(() => ({}));

    // Interakt returns the message ID in the response body — capture it for webhook correlation
    const interaktMessageId =
      typeof responseBody.id === "string" ? responseBody.id
      : typeof (responseBody.data as Record<string, unknown>)?.id === "string"
        ? (responseBody.data as Record<string, unknown>).id as string
        : null;

    return { success: res.ok, responseBody, httpStatus, interaktMessageId };
  } catch (err) {
    return {
      success: false,
      responseBody: { fetchError: String(err) },
      httpStatus: 0,
      interaktMessageId: null,
    };
  }
}

// ─── Delivery Logging ─────────────────────────────────────────────────────────

/**
 * Writes a delivery record to whatsapp_delivery_log.
 * Called after every send attempt regardless of outcome.
 * Uses service_role client so it bypasses RLS.
 */
export async function logDelivery(
  supabase: SupabaseClient,
  params: LogDeliveryParams,
): Promise<void> {
  const { error } = await supabase.from("whatsapp_delivery_log").insert({
    org_id: params.orgId,
    owner_profile_id: params.ownerProfileId ?? null,
    recipient_phone: params.recipientPhone,
    template_name: params.templateName,
    notification_type: params.notificationType,
    status: params.status,
    interakt_callback_data: params.callbackData,
    interakt_message_id: params.interaktMessageId ?? null,
    error_message: params.errorMessage ?? null,
    payload_snapshot: params.payloadSnapshot,
  });

  if (error) {
    // Log but don't throw — delivery logging failure should never crash the send path
    console.error("[logDelivery] Failed to log delivery:", error.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "31 Mar 2026" style date label in IST (Asia/Kolkata) */
export function getSuratDateLabel(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

/** Returns "YYYY-MM-DD" in IST — matches production_logs.date format */
export function getSuratTodayString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

/** Returns "HH:MM" time string in IST */
export function getSuratTimeLabel(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

/** Formats a number as Indian locale: 1,23,456 (no ₹ prefix — templates add their own) */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** Unique callback data for tracing in Interakt delivery webhooks */
export function makeCallbackData(prefix: string, orgId: string): string {
  return `${prefix}_${orgId}_${Date.now()}`;
}
