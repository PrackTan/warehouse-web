import React from 'react'
import { loadWarehouseLiveSnapshot } from '@/lib/googleDriveWarehouse'
import { WarehouseMobileApp } from '@/components/WarehouseMobileApp'

export const dynamic = 'force-dynamic'

/**
 * Trang chủ (/): Tra cứu nhanh toàn bộ thùng & vật tư Kho IT
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const result = await loadWarehouseLiveSnapshot()
  return <WarehouseMobileApp initialResult={result} />
}

