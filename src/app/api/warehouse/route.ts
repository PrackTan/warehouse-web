import { NextResponse } from 'next/server'
import { loadWarehouseLiveSnapshot } from '@/lib/googleDriveWarehouse'

export const dynamic = 'force-dynamic'

/**
 * GET /api/warehouse: Tải dữ liệu thùng & vật tư Kho IT mới nhất từ Google Drive
 */
export async function GET(): Promise<NextResponse> {
  const result = await loadWarehouseLiveSnapshot()
  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.missingEnv ? 500 : result.notInitialized ? 404 : 502,
      headers: { 'Cache-Control': 'no-store' }
    })
  }

  return NextResponse.json(
    { ok: true, data: result.snapshot },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}

