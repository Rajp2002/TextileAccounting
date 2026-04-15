// ─── Shared Meta WhatsApp Utility ─────────────────────────────────────────────
// Used by all send-* edge functions. Import with:
//   import { sendWhatsAppTemplate, logDelivery, formatInr, getSuratDateLabel, getSuratTodayString, makeCallbackData } from "../_shared/whatsapp.ts";

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsAppResult {
  success: boolean;
  responseBody: Record<string, unknown>;
  httpStatus: number;
  /** Message ID returned by Meta — persisted to whatsapp_delivery_log */
  messageId: string | null;
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
  /** Meta's message ID from the send response */
  messageId?: string | null;
}

// ─── Core Send Function ───────────────────────────────────────────────────────

/**
 * Sends a WhatsApp template message via official Meta WhatsApp Cloud API.
 * Returns result including parsed response body for logging.
 */
export async function sendWhatsAppTemplate(
  accessToken: string,
  phoneNumberId: string,
  phone: string,
  templateName: string,
  languageCode: string = "en",
  bodyValues: string[],
  callbackData: string,
): Promise<WhatsAppResult> {
  // Ensure phone has Indian country code prefix
  const formattedPhone = phone.startsWith("91") && phone.length === 12 
    ? phone 
    : phone.length === 10 ? `91${phone}` : phone;

  const META_API = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  // Map simple string arrays to Meta's verbose component structure
  const parameters = bodyValues.map(val => ({
    type: "text",
    text: String(val)
  }));

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      // Only include body component if there are values to inject
      components: parameters.length > 0 ? [
        {
          type: "body",
          parameters: parameters
        }
      ] : []
    },
    // Meta doesn't have a native passthrough for random callbackData like Interakt does,
    // but the WABA webhooks will send back the `wamid` which we store to correlate.
  };

  let responseBody: Record<string, unknown> = {};
  let httpStatus = 0;

  try {
    // Support for provider simulation (testing mode)
    const provider = Deno.env.get("WHATSAPP_PROVIDER") || "meta";
    if (provider === "simulate") {
      console.log(`[SIMULATE] WhatsApp to ${formattedPhone}: ${templateName}`);
      return { 
        success: true, 
        responseBody: { simulated: true }, 
        httpStatus: 200, 
        messageId: `sim_wamid_${Date.now()}` 
      };
    }

    const res = await fetch(META_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    httpStatus = res.status;
    responseBody = await res.json().catch(() => ({}));

    // Meta returns the message ID inside messages[0].id
    let messageId = null;
    if (responseBody.messages && Array.isArray(responseBody.messages) && responseBody.messages.length > 0) {
      messageId = responseBody.messages[0].id;
    }

    return { success: res.ok, responseBody, httpStatus, messageId };
  } catch (err) {
    return {
      success: false,
      responseBody: { fetchError: String(err) },
      httpStatus: 0,
      messageId: null,
    };
  }
}

// ─── Delivery Logging ─────────────────────────────────────────────────────────

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
    interakt_message_id: params.messageId ?? null, // Storing Meta wamid here for now to avoid migration
    error_message: params.errorMessage ?? null,
    payload_snapshot: params.payloadSnapshot,
  });

  if (error) {
    console.error("[logDelivery] Failed to log delivery:", error.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSuratDateLabel(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

export function getSuratTodayString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export function getSuratTimeLabel(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function makeCallbackData(prefix: string, orgId: string): string {
  return `${prefix}_${orgId}_${Date.now()}`;
}
