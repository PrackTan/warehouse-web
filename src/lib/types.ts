export type Warehouse5SStatus = 'good' | 'repair' | 'scrap'
export type WarehouseRoomCode = 'storage_room' | 'working_room'
export type WarehouseTxType = 'import' | 'export' | 'adjust'

export interface RawZoneRecord {
  id: string
  room_code: WarehouseRoomCode
  code: string
  name: string
  sort_order?: number
  deleted_at?: string | null
}

export interface RawBinRecord {
  id: string
  zone_id: string
  bin_code: string
  tier_number: number
  name: string
  status_5s: Warehouse5SStatus
  sort_order?: number
  deleted_at?: string | null
}

export interface RawItemRecord {
  id: string
  bin_id: string
  name: string
  category?: string
  quantity: number
  unit?: string
  min_quantity?: number
  note?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export interface RawTransactionRecord {
  id: string
  item_id: string
  bin_id: string
  tx_type: WarehouseTxType
  quantity_change: number
  quantity_after: number
  target_department?: string
  performed_by?: string
  note?: string
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface AppliedIdempotencyKey {
  key: string
  item_id: string
  tx_type: string
  quantity_after: number
  created_at: string
}

export interface WarehouseLiveCloudPayload {
  version: string
  last_updated: string
  warehouse_zones: RawZoneRecord[]
  warehouse_bins: RawBinRecord[]
  warehouse_items: RawItemRecord[]
  warehouse_transactions: RawTransactionRecord[]
  applied_keys?: AppliedIdempotencyKey[]
}

export interface EnrichedItem extends RawItemRecord {
  bin_code?: string
  bin_name?: string
}

export interface EnrichedBin extends RawBinRecord {
  room_code: WarehouseRoomCode
  zone_name: string
  zone_code: string
  items: EnrichedItem[]
  total_quantity: number
}

export interface EnrichedTransaction extends RawTransactionRecord {
  item_name?: string
  bin_code?: string
}

export interface WebWarehouseSnapshot {
  lastUpdated: string
  bins: EnrichedBin[]
  transactions: EnrichedTransaction[]
}

export interface LoadWarehouseResult {
  ok: boolean
  missingEnv?: boolean
  notInitialized?: boolean
  error?: string
  snapshot?: WebWarehouseSnapshot
}

/**
 * Một hạng mục thay đổi số lượng trong yêu cầu lưu hàng loạt (Batch Adjust API)
 */
export interface BatchAdjustChangeItem {
  itemId: string
  txType: WarehouseTxType
  amount: number
  note?: string
}

/**
 * Trạng thái chỉnh sửa nháp của từng sản phẩm trong thùng trước khi gửi lên Backend
 */
export interface DraftItemEdit {
  quantity: number
  mode: 'delta' | 'adjust'
}

/**
 * Bản ghi đối chiếu thay đổi (Cũ -> Mới) hiển thị trong Hộp thoại xác nhận lần 2
 */
export interface PendingQuantityChange {
  item: EnrichedItem
  originalQty: number
  draftQty: number
  delta: number
  txType: WarehouseTxType
  apiAmount: number
}

