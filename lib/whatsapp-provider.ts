export type WhatsAppProvider = 'disabled' | 'simulate' | 'meta'

/**
 * Live WhatsApp is post-pilot. An absent or unrecognized provider setting must
 * therefore fail closed without making a provider request.
 */
export function resolveWhatsAppProvider(value = process.env.WHATSAPP_PROVIDER): WhatsAppProvider {
    if (value === 'simulate' || value === 'meta') return value
    return 'disabled'
}

export function isWhatsAppDeliveryEnabled(value = process.env.WHATSAPP_PROVIDER) {
    return resolveWhatsAppProvider(value) !== 'disabled'
}
