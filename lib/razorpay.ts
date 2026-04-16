import Razorpay from 'razorpay'

/**
 * Razorpay SDK singleton.
 *
 * CRITICAL: Only import in Server Actions and Route Handlers.
 * The key_secret MUST stay server-only — never pass it to client components.
 *
 * Test mode: keys start with rzp_test_...
 * Live mode:  keys start with rzp_live_... (after KYC)
 */
export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})
