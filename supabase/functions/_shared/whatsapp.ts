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

export type WhatsAppSimulationMode =
  | "success"
  | "timeout"
  | "provider_failure"
  | "template_rejected"
  | "expired_token";

const SIMULATION_MODES = new Set<WhatsAppSimulationMode>([
  "success",
  "timeout",
  "provider_failure",
  "template_rejected",
  "expired_token",
]);

type WhatsAppProvider = "disabled" | "simulate" | "meta";

function resolveWhatsAppProvider(value?: string | null): WhatsAppProvider {
  return value === "simulate" || value === "meta" ? value : "disabled";
}

function providerUnavailableResult(code: "provider_disabled" | "provider_unconfigured"): WhatsAppResult {
  const message = code === "provider_disabled"
    ? "WhatsApp is disabled for this release; retain the business write and use the manual fallback."
    : "Live WhatsApp credentials are incomplete; retain the business write and use the manual fallback.";
  return {
    success: false,
    responseBody: { error: { code, message } },
    httpStatus: 0,
    messageId: null,
  };
}

function normalizeSimulationMode(value?: string | null): WhatsAppSimulationMode {
  return value && SIMULATION_MODES.has(value as WhatsAppSimulationMode)
    ? value as WhatsAppSimulationMode
    : "success";
}

function simulatedResult(mode: WhatsAppSimulationMode, kind: "template" | "freeform"): WhatsAppResult {
  const base = { simulated: true, mode, kind };
  if (mode === "success") {
    return {
      success: true,
      responseBody: base,
      httpStatus: 200,
      messageId: `sim_${kind}_wamid_${crypto.randomUUID()}`,
    };
  }

  const failures: Record<Exclude<WhatsAppSimulationMode, "success">, {
    httpStatus: number;
    code: string;
    message: string;
  }> = {
    timeout: {
      httpStatus: 0,
      code: "provider_timeout",
      message: "WhatsApp provider timed out; the business write is retained and the message can be retried manually.",
    },
    provider_failure: {
      httpStatus: 503,
      code: "provider_unavailable",
      message: "WhatsApp provider is unavailable; use the logged manual fallback.",
    },
    template_rejected: {
      httpStatus: 400,
      code: "template_rejected",
      message: "Meta rejected the template; review template approval and use the manual fallback.",
    },
    expired_token: {
      httpStatus: 401,
      code: "expired_token",
      message: "Meta access token is expired; rotate the token and use the manual fallback.",
    },
  };
  const failure = failures[mode];
  return {
    success: false,
    responseBody: { ...base, error: { code: failure.code, message: failure.message } },
    httpStatus: failure.httpStatus,
    messageId: null,
  };
}

export interface LogDeliveryParams {
  orgId: string;
  ownerProfileId?: string | null;
  recipientPhone: string;
  templateName: string;
  notificationType: string;
  callbackData: string;
  status: "sent" | "failed" | "skipped_opted_out" | "skipped_missing_consent" | "skipped_missing_phone" | "skipped_phone_mismatch";
  errorMessage?: string | null;
  payloadSnapshot: Record<string, unknown>;
  /** Meta's message ID from the send response */
  messageId?: string | null;
}

// ─── Consent Logic ───────────────────────────────────────────────────────────

export interface ConsentCheckResult {
  allowed: boolean;
  reason: "opted_in" | "opted_out" | "missing_consent" | "missing_phone" | "phone_mismatch" | "unsupported_person_type";
}

export async function checkWhatsAppConsent(
  supabase: SupabaseClient,
  orgId: string,
  personType: 'owner' | 'supervisor' | 'worker' | 'party',
  personId: string,
  phone?: string | null
): Promise<ConsentCheckResult> {
  if (!phone) {
    return { allowed: false, reason: "missing_phone" };
  }

  if (personType === 'owner' || personType === 'supervisor') {
    const { data, error } = await supabase
      .from('profiles')
      .select('whatsapp_opted_in')
      .eq('id', personId)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error("[checkWhatsAppConsent] Error fetching profile:", error);
      return { allowed: false, reason: "missing_consent" };
    }

    if (data?.whatsapp_opted_in) {
      return { allowed: true, reason: "opted_in" };
    } else {
      return { allowed: false, reason: "opted_out" };
    }
  }

  if (personType === 'worker' || personType === 'party') {
    const { data, error } = await supabase
      .from('notification_consents')
      .select('consent_status, phone')
      .eq('org_id', orgId)
      .eq('person_type', personType)
      .eq('person_id', personId)
      .eq('channel', 'whatsapp')
      .maybeSingle();

    if (error) {
      console.error("[checkWhatsAppConsent] Error fetching consent:", error);
      return { allowed: false, reason: "missing_consent" };
    }

    if (!data) {
      return { allowed: false, reason: "missing_consent" };
    }

    if (data.consent_status === 'opted_in' && data.phone?.replace(/\D/g, '') !== phone.replace(/\D/g, '')) {
      return { allowed: false, reason: "phone_mismatch" };
    }

    if (data.consent_status === 'opted_in') {
      return { allowed: true, reason: "opted_in" };
    } else {
      return { allowed: false, reason: "opted_out" };
    }
  }

  return { allowed: false, reason: "unsupported_person_type" };
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
  _callbackData: string,
  requestedSimulationMode?: string,
): Promise<WhatsAppResult> {
  void _callbackData;
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
    const provider = resolveWhatsAppProvider(Deno.env.get("WHATSAPP_PROVIDER"));
    if (provider === "disabled") {
      return providerUnavailableResult("provider_disabled");
    }
    if (provider === "simulate") {
      const mode = normalizeSimulationMode(requestedSimulationMode ?? Deno.env.get("WHATSAPP_SIMULATION_MODE"));
      console.log(`[SIMULATE:${mode}] WhatsApp template: ${templateName}`);
      return simulatedResult(mode, "template");
    }
    if (!accessToken || !phoneNumberId) {
      return providerUnavailableResult("provider_unconfigured");
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

/**
 * Sends a free-form (non-template) WhatsApp text message.
 * This is only perimtted within a 24-hour service window initiated by the customer.
 * Used for sending itemized payslip breakdowns after the initial summary template.
 */
export async function sendWhatsAppFreeform(
  accessToken: string,
  phoneNumberId: string,
  phone: string,
  message: string,
  requestedSimulationMode?: string,
): Promise<WhatsAppResult> {
  const formattedPhone = phone.startsWith("91") && phone.length === 12 
    ? phone 
    : phone.length === 10 ? `91${phone}` : phone;

  const META_API = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: {
      body: message
    }
  };

  try {
    const provider = resolveWhatsAppProvider(Deno.env.get("WHATSAPP_PROVIDER"));
    if (provider === "disabled") {
      return providerUnavailableResult("provider_disabled");
    }
    if (provider === "simulate") {
      const mode = normalizeSimulationMode(requestedSimulationMode ?? Deno.env.get("WHATSAPP_SIMULATION_MODE"));
      console.log(`[SIMULATE FREEFORM:${mode}] WhatsApp freeform message queued`);
      return simulatedResult(mode, "freeform");
    }
    if (!accessToken || !phoneNumberId) {
      return providerUnavailableResult("provider_unconfigured");
    }

    const res = await fetch(META_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await res.json().catch(() => ({}));
    let messageId = null;
    if (responseBody.messages?.[0]?.id) {
      messageId = responseBody.messages[0].id;
    }

    return { success: res.ok, responseBody, httpStatus: res.status, messageId };
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
    meta_callback_data: params.callbackData,
    meta_message_id: params.messageId ?? null, // Storing Meta wamid here
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
