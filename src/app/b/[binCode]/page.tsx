import React from 'react'
import { loadWarehouseLiveSnapshot } from '@/lib/googleDriveWarehouse'
import { WarehouseMobileApp } from '@/components/WarehouseMobileApp'

export const dynamic = 'force-dynamic'

/**
 * Trang chi tiết thùng (/b/THUNG-01): Mở thẳng từ Camera / Zalo khi quét mã QR dán trên thùng
 */
export default async function BinDetailPage({
  params
}: {
  params: Promise<{ binCode: string }>
}): Promise<React.JSX.Element> {
  const { binCode } = await params
  const result = await loadWarehouseLiveSnapshot()
  return <WarehouseMobileApp initialResult={result} initialBinCode={binCode} />
}

