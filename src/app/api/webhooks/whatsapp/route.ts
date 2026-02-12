// =============================================================================
// WhatsApp Webhook Route Handler
// GET  -> Webhook verification (Meta subscription handshake)
// POST -> Receive incoming messages and status updates
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { processWebhookPayload } from '@/lib/whatsapp/webhook-handler'

// -----------------------------------------------------------------------------
// GET - Webhook Verification
// Meta sends a GET request with hub.mode, hub.verify_token, hub.challenge
// We must respond with the challenge value if the token matches.
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    console.log('WhatsApp webhook verified successfully')
    // Must return the challenge as plain text with 200 status
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  console.warn('WhatsApp webhook verification failed', { mode, token })
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// -----------------------------------------------------------------------------
// POST - Receive Messages
// 1. Verify HMAC-SHA256 signature from x-hub-signature-256 header
// 2. Parse body
// 3. Return 200 IMMEDIATELY (Meta requires fast response)
// 4. Process asynchronously (fire-and-forget)
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.text()

  // --- Signature Verification ---
  const signature = request.headers.get('x-hub-signature-256')
  const appSecret = process.env.WHATSAPP_APP_SECRET

  if (!appSecret) {
    console.error('WHATSAPP_APP_SECRET is not configured')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  if (!signature) {
    console.warn('Missing x-hub-signature-256 header')
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 401 }
    )
  }

  // The signature header format is: sha256=<hex_hash>
  const expectedSignature =
    'sha256=' +
    createHmac('sha256', appSecret).update(body).digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(signature, expectedSignature)) {
    console.warn('Invalid webhook signature')
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  // --- Parse and process ---
  let payload: any

  try {
    payload = JSON.parse(body)
  } catch {
    console.error('Failed to parse webhook body as JSON')
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  // Return 200 immediately - Meta requires response within a few seconds.
  // Process the payload asynchronously (fire-and-forget).
  // In Vercel/Next.js edge or serverless, this will continue executing
  // until the function completes, even after returning the response.
  processWebhookPayload(payload).catch((error) => {
    console.error('Error processing webhook payload:', error)
  })

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}

// -----------------------------------------------------------------------------
// Constant-time string comparison to prevent timing attacks
// Using Buffer comparison for safety
// -----------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid leaking length info via timing
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(a) // intentionally use 'a' for both
    try {
      require('crypto').timingSafeEqual(bufA, bufB)
    } catch {
      // ignore
    }
    return false
  }

  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  try {
    return require('crypto').timingSafeEqual(bufA, bufB)
  } catch {
    // Fallback: simple comparison (less secure but functional)
    return a === b
  }
}
