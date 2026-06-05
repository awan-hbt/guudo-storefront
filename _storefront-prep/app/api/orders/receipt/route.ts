import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { notifyAdminReceiptUploaded } from '@/lib/watzap'

export async function PATCH(req: NextRequest) {
  const { referenceCode, receiptUrl } = await req.json()

  if (!referenceCode || !receiptUrl) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!receiptUrl.startsWith(supabaseUrl)) {
    return NextResponse.json({ error: 'Invalid receipt URL' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error, count } = await supabase
    .from('orders')
    .update({ receipt_url: String(receiptUrl) }, { count: 'exact' })
    .eq('reference_code', String(referenceCode))

  if (error) {
    return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Kode referensi tidak ditemukan.' }, { status: 404 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('name, phone, total_price, memo')
    .eq('reference_code', String(referenceCode))
    .single()

  if (order) {
    notifyAdminReceiptUploaded({
      referenceCode: String(referenceCode),
      name: order.name,
      phone: order.phone,
      totalPrice: order.total_price,
      memo: order.memo,
      receiptUrl: String(receiptUrl),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
