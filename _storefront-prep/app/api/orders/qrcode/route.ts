import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const qrData = req.nextUrl.searchParams.get('data')?.trim()
  const download = req.nextUrl.searchParams.get('download') === '1'

  if (!qrData) {
    return NextResponse.json({ error: 'Missing QR data' }, { status: 400 })
  }

  const upstreamUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=256x256&margin=8`
  const upstreamRes = await fetch(upstreamUrl, {
    headers: {
      Accept: 'image/png',
    },
    cache: 'no-store',
  })

  if (!upstreamRes.ok) {
    return NextResponse.json({ error: 'Failed to generate QR code image' }, { status: 502 })
  }

  const imageBuffer = await upstreamRes.arrayBuffer()

  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'Content-Disposition': download
        ? 'attachment; filename="qris-payment.png"'
        : 'inline; filename="qris-payment.png"',
    },
  })
}