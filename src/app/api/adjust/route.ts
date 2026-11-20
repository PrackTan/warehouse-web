import { NextRequest, NextResponse } from 'next/server'
import { adjustWarehouseBatchOnDrive } from '@/lib/googleDriveWarehouse'
import type { BatchAdjustChangeItem, WarehouseTxType } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Kiểm tra loại giao dịch hợp lệ theo danh sách trắng (Whitelist)
 */
function isValidTxType(value: unknown): value is WarehouseTxType {
  return value === 'import' || value === 'export' || value === 'adjust'
}

/**
 * POST /api/adjust: Xuất / Nhập / Kiểm kê số lượng trực tiếp từ điện thoại
 * - Hỗ trợ cả định dạng gộp nhiều sản phẩm (`changes: [...]`) lẫn định dạng đơn lẻ cũ (`itemId, txType, amount`)
 * - Đọc Header `Idempotency-Key` để chống trừ/cộng kho 2 lần khi mạng 4G chập chờn hoặc bấm đúp
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      changes?: Array<{
        itemId?: unknown
        txType?: unknown
        amount?: unknown
        note?: unknown
      }>
      itemId?: unknown
      txType?: unknown
      amount?: unknown
      targetDepartment?: string
      performedBy?: string
      note?: string
    }

    // Chuẩn hóa danh sách thay đổi về mảng chung BatchAdjustChangeItem[]
    const normalizedChanges: BatchAdjustChangeItem[] = []

    if (Array.isArray(body.changes)) {
      if (body.changes.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Danh sách thay đổi trống — chưa có sản phẩm nào cần lưu.' },
          { status: 400 }
        )
      }
      if (body.changes.length > 100) {
        return NextResponse.json(
          { ok: false, error: 'Mỗi lần chỉ được lưu tối đa 100 sản phẩm.' },
          { status: 400 }
        )
      }

      for (const raw of body.changes) {
        const itemId = String(raw?.itemId || '').trim()
        const amount = Number(raw?.amount)
        if (!itemId || !isValidTxType(raw?.txType) || !Number.isFinite(amount)) {
          return NextResponse.json(
            { ok: false, error: 'Có sản phẩm trong danh sách lưu thiếu mã hoặc số lượng không hợp lệ.' },
            { status: 400 }
          )
        }
        normalizedChanges.push({
          itemId,
          txType: raw.txType,
          amount,
          note: typeof raw.note === 'string' ? raw.note : undefined
        })
      }
    } else {
      // Tương thích ngược với yêu cầu chỉnh sửa đơn lẻ (single-item)
      const itemId = String(body.itemId || '').trim()
      const amount = Number(body.amount)
      if (!itemId || !isValidTxType(body.txType) || !Number.isFinite(amount)) {
        return NextResponse.json(
          { ok: false, error: 'Thiếu thông tin sản phẩm hoặc loại giao dịch không hợp lệ.' },
          { status: 400 }
        )
      }
      normalizedChanges.push({
        itemId,
        txType: body.txType,
        amount,
        note: typeof body.note === 'string' ? body.note : undefined
      })
    }

    const idempotencyKey = req.headers.get('Idempotency-Key') || undefined
    const res = await adjustWarehouseBatchOnDrive({
      changes: normalizedChanges,
      targetDepartment: body.targetDepartment,
      performedBy: body.performedBy,
      note: body.note,
      idempotencyKey
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: res.statusCode })
    }

    return NextResponse.json(
      {
        ok: true,
        idempotent: res.idempotent,
        appliedCount: res.appliedCount ?? normalizedChanges.length,
        data: res.snapshot
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Lỗi xử lý yêu cầu' },
      { status: 500 }
    )
  }
}

