import { NextResponse } from 'next/server'

/**
 * Retained as an explicit tombstone for old cached clients. Razorpay Checkout
 * is loaded only from the official provider origin by current application code.
 */
export async function GET() {
    return NextResponse.json(
        { error: 'The legacy checkout-script proxy has been retired.' },
        { status: 410, headers: { 'Cache-Control': 'no-store' } },
    )
}
