import Razorpay from 'razorpay'

/**
 * Lazily-created Razorpay SDK client.
 *
 * CRITICAL: Only import in Server Actions and Route Handlers.
 * The key_secret MUST stay server-only — never pass it to client components.
 *
 * Test mode: keys start with rzp_test_...
 * Live mode:  keys start with rzp_live_... (after KYC)
 */
let razorpayClient: InstanceType<typeof Razorpay> | null = null

export function getRazorpay() {
    if (!razorpayClient) {
        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keyId || !keySecret) {
            throw new Error('Razorpay server credentials are not configured.')
        }

        razorpayClient = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        })
    }

    return razorpayClient
}
