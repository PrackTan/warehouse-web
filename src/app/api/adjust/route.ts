import { NextRequest, NextResponse } from 'next/server'
import { adjustWarehouseStockOnDrive } from '@/lib/googleDriveWarehouse'
import type { WarehouseTxType } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/adjust: Xuất / Nhập / Kiểm kê số lượng trực tiếp từ điện thoại (Không cần PIN, có Idempotency-Key chống bấm đúp)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      itemId?: string
      txType?: WarehouseTxType
      amount?: number
      targetDepartment?: string
      performedBy?: string
      note?: string
    }

    const itemId = String(body.itemId || '').trim()
    const txType = body.txType
    const amount = Number(body.amount)

    if (!itemId || (txType !== 'import' && txType !== 'export' && txType !== 'adjust')) {
      return NextResponse.json(
        { ok: false, error: 'Thiếu thông tin sản phẩm hoặc loại giao dịch không hợp lệ.' },
        { status: 400 }
      )
    }

    const idempotencyKey = req.headers.get('Idempotency-Key') || undefined
    const res = await adjustWarehouseStockOnDrive({
      itemId,
      txType,
      amount,
      targetDepartment: body.targetDepartment,
      performedBy: body.performedBy,
      note: body.note,
      idempotencyKey
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: res.statusCode })
    }

    return NextResponse.json(
      { ok: true, idempotent: res.idempotent, data: res.snapshot },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Lỗi xử lý yêu cầu' },
      { status: 500 }
    )
  }
}

