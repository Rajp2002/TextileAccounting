type RazorpayRefundResponse = {
  id: string
  status?: string
}

function requireCredential(name: 'RAZORPAY_KEY_ID' | 'RAZORPAY_KEY_SECRET'): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

/**
 * Create a Razorpay refund with the provider-supported idempotency header.
 * The same payment and key can be retried after an unknown network outcome
 * without issuing a second refund.
 */
export async function createIdempotentRazorpayRefund({
  paymentId,
  amountPaise,
  idempotencyKey,
  note,
}: {
  paymentId: string
  amountPaise: number
  idempotencyKey: string
  note: string
}): Promise<RazorpayRefundResponse> {
  const keyId = requireCredential('RAZORPAY_KEY_ID')
  const keySecret = requireCredential('RAZORPAY_KEY_SECRET')
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${authorization}`,
        'content-type': 'application/json',
        'x-refund-idempotency': idempotencyKey,
      },
      body: JSON.stringify({
        amount: amountPaise,
        notes: { reason: note },
      }),
    }
  )

  const payload = await response.json().catch(() => null) as RazorpayRefundResponse | null
  if (!response.ok || !payload?.id) {
    throw new Error(`Razorpay refund request failed with HTTP ${response.status}.`)
  }

  return payload
}
