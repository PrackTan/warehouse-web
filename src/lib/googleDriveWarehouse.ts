import type {
  EnrichedBin,
  EnrichedItem,
  EnrichedTransaction,
  LoadWarehouseResult,
  RawBinRecord,
  RawItemRecord,
  RawTransactionRecord,
  RawZoneRecord,
  WarehouseLiveCloudPayload,
  WarehouseTxType,
  WebWarehouseSnapshot
} from './types'

interface DecodedDriveKey {
  client_id: string
  client_secret: string
  refresh_token: string
  root_folder_id?: string
  db_folder_id?: string
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const LIVE_FILE_NAME = 'warehouse_live.json'

// Bộ nhớ đệm ngắn trong vòng đời Serverless Function để giảm số lượt gọi API Google Drive
let cachedToken: { value: string; expiresAt: number } | null = null
let cachedDbFolderId: string | null = null
let cachedLiveFileId: string | null = null

/**
 * Giải mã biến môi trường WIKIHIS_DRIVE_KEY (Base64 JSON) được copy từ WikiHIS Desktop
 */
function parseDriveKey(): DecodedDriveKey | null {
  const raw = process.env.WIKIHIS_DRIVE_KEY?.trim()
  if (!raw) return null

  try {
    const jsonText = raw.startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf-8')
    const parsed = JSON.parse(jsonText) as Partial<DecodedDriveKey>
    if (!parsed.client_id || !parsed.client_secret || !parsed.refresh_token) {
      return null
    }
    return parsed as DecodedDriveKey
  } catch {
    return null
  }
}

/**
 * Đổi refresh_token lấy access_token Google Drive mới bằng fetch() thuần
 */
async function getAccessToken(key: DecodedDriveKey): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value
  }

  const params = new URLSearchParams({
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: key.refresh_token,
    grant_type: 'refresh_token'
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store'
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Không thể làm mới token Google Drive (${res.status}): ${errBody}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number }
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3500) * 1000
  }
  return cachedToken.value
}

/**
 * Tìm ID 1 tệp hoặc thư mục trên Google Drive theo câu truy vấn
 */
async function findDriveItemId(accessToken: string, query: string): Promise<string | null> {
  const url = `${DRIVE_API}/files?${new URLSearchParams({
    q: query,
    fields: 'files(id,name)',
    pageSize: '1',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true'
  }).toString()}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Lỗi tìm kiếm Google Drive (${res.status}): ${msg}`)
  }

  const data = (await res.json()) as { files?: Array<{ id: string }> }
  return data.files?.[0]?.id || null
}

/**
 * Xác định fileId của db/warehouse_live.json trên Google Drive
 */
async function resolveLiveFileId(accessToken: string, key: DecodedDriveKey): Promise<string | null> {
  if (cachedLiveFileId) return cachedLiveFileId

  if (!cachedDbFolderId) {
    if (key.db_folder_id) {
      cachedDbFolderId = key.db_folder_id
    } else if (key.root_folder_id) {
      cachedDbFolderId = await findDriveItemId(
        accessToken,
        `'${key.root_folder_id}' in parents and name = 'db' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      )
    } else {
      const rootId = await findDriveItemId(
        accessToken,
        `name = 'WikiHIS' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      )
      if (rootId) {
        cachedDbFolderId = await findDriveItemId(
          accessToken,
          `'${rootId}' in parents and name = 'db' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        )
      }
    }
  }

  if (!cachedDbFolderId) return null

  cachedLiveFileId = await findDriveItemId(
    accessToken,
    `'${cachedDbFolderId}' in parents and name = '${LIVE_FILE_NAME}' and trashed = false`
  )
  return cachedLiveFileId
}

/**
 * Tải nội dung raw JSON của db/warehouse_live.json
 */
async function readRawLivePayload(
  key: DecodedDriveKey
): Promise<{ fileId: string; payload: WarehouseLiveCloudPayload } | null> {
  const accessToken = await getAccessToken(key)
  let fileId = await resolveLiveFileId(accessToken, key)
  if (!fileId) return null

  const downloadUrl = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
  let res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  })

  // Nếu fileId bị thay đổi -> xóa cache và tìm lại 1 lần
  if (res.status === 404) {
    cachedLiveFileId = null
    fileId = await resolveLiveFileId(accessToken, key)
    if (!fileId) return null
    res = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      }
    )
  }

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Không đọc được dữ liệu Kho IT (${res.status}): ${errText}`)
  }

  const payload = (await res.json()) as WarehouseLiveCloudPayload
  return { fileId, payload }
}

/**
 * Chuyển đổi mảng 4 bảng raw thành Snapshot gọn nhẹ cho UI điện thoại
 */
export function buildWebSnapshot(raw: WarehouseLiveCloudPayload): WebWarehouseSnapshot {
  const zones = (raw.warehouse_zones || []).filter((z: RawZoneRecord) => !z.deleted_at)
  const zoneMap = new Map<string, RawZoneRecord>()
  for (const z of zones) zoneMap.set(z.id, z)

  const activeItems = (raw.warehouse_items || []).filter((it: RawItemRecord) => !it.deleted_at)
  const itemsByBin = new Map<string, EnrichedItem[]>()
  const itemMap = new Map<string, RawItemRecord>()

  for (const it of activeItems) {
    itemMap.set(it.id, it)
    const list = itemsByBin.get(it.bin_id) || []
    list.push(it)
    itemsByBin.set(it.bin_id, list)
  }

  const activeBins = (raw.warehouse_bins || [])
    .filter((b: RawBinRecord) => !b.deleted_at)
    .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))

  const binMap = new Map<string, RawBinRecord>()
  const bins: EnrichedBin[] = activeBins.map((b) => {
    binMap.set(b.id, b)
    const zone = zoneMap.get(b.zone_id)
    const binItems = itemsByBin.get(b.id) || []
    const totalQty = binItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)

    return {
      ...b,
      room_code: zone?.room_code || 'storage_room',
      zone_name: zone?.name || 'Khu vực Kho IT',
      zone_code: zone?.code || '',
      items: binItems.map((i) => ({
        ...i,
        bin_code: b.bin_code,
        bin_name: b.name
      })),
      total_quantity: totalQty
    }
  })

  const transactions: EnrichedTransaction[] = (raw.warehouse_transactions || [])
    .filter((t: RawTransactionRecord) => !t.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 60)
    .map((t) => ({
      ...t,
      item_name: itemMap.get(t.item_id)?.name || 'Sản phẩm',
      bin_code: binMap.get(t.bin_id)?.bin_code || ''
    }))

  return {
    lastUpdated: raw.last_updated || new Date().toISOString(),
    bins,
    transactions
  }
}

/**
 * Đọc Snapshot Kho IT mới nhất từ Google Drive cho Server Components & API
 */
export async function loadWarehouseLiveSnapshot(): Promise<LoadWarehouseResult> {
  const key = parseDriveKey()
  if (!key) {
    return {
      ok: false,
      missingEnv: true,
      error: 'Chưa cấu hình biến môi trường WIKIHIS_DRIVE_KEY trên Vercel.'
    }
  }

  try {
    const fileRes = await readRawLivePayload(key)
    if (!fileRes) {
      return {
        ok: false,
        notInitialized: true,
        error:
          'Chưa tìm thấy tệp db/warehouse_live.json trên Google Drive. Hãy mở WikiHIS Desktop -> bấm "Đồng bộ Web" trong mục In Nhãn QR.'
      }
    }

    return {
      ok: true,
      snapshot: buildWebSnapshot(fileRes.payload)
    }
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Thực thi giao dịch Xuất / Nhập / Kiểm kê và ghi trực tiếp vào db/warehouse_live.json
 * (Không yêu cầu PIN; bảo vệ chống bấm đúp khi lag mạng bằng Idempotency-Key)
 */
export async function adjustWarehouseStockOnDrive(input: {
  itemId: string
  txType: WarehouseTxType
  amount: number
  targetDepartment?: string
  performedBy?: string
  note?: string
  idempotencyKey?: string
}): Promise<{
  ok: boolean
  idempotent?: boolean
  statusCode: number
  error?: string
  snapshot?: WebWarehouseSnapshot
}> {
  const key = parseDriveKey()
  if (!key) {
    return {
      ok: false,
      statusCode: 500,
      error: 'Thiếu biến môi trường WIKIHIS_DRIVE_KEY trên server.'
    }
  }

  const fileRes = await readRawLivePayload(key)
  if (!fileRes) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Không tìm thấy db/warehouse_live.json trên Google Drive.'
    }
  }

  const { fileId, payload } = fileRes
  const cleanKey = (input.idempotencyKey || '').trim()

  // Kiểm tra Idempotency-Key tránh cộng/trừ kho 2 lần khi mạng 4G chập chờn
  if (cleanKey && Array.isArray(payload.applied_keys)) {
    const existed = payload.applied_keys.find((k) => k.key === cleanKey)
    if (existed) {
      return {
        ok: true,
        idempotent: true,
        statusCode: 200,
        snapshot: buildWebSnapshot(payload)
      }
    }
  }

  const amount = Math.floor(Number(input.amount) || 0)
  if ((input.txType === 'export' || input.txType === 'import') && amount <= 0) {
    return { ok: false, statusCode: 400, error: 'Số lượng Xuất / Nhập phải lớn hơn 0.' }
  }
  if (input.txType === 'adjust' && amount < 0) {
    return { ok: false, statusCode: 400, error: 'Số lượng kiểm kê không thể âm.' }
  }

  const items = payload.warehouse_items || []
  const itemIdx = items.findIndex((it) => it.id === input.itemId && !it.deleted_at)
  if (itemIdx === -1) {
    return { ok: false, statusCode: 404, error: 'Không tìm thấy sản phẩm trong thùng.' }
  }

  const targetItem = items[itemIdx]
  const currentQty = Number(targetItem.quantity) || 0
  let nextQty = currentQty
  let qtyChange = 0

  if (input.txType === 'export') {
    if (amount > currentQty) {
      return {
        ok: false,
        statusCode: 400,
        error: `Không đủ tồn kho: hiện chỉ còn ${currentQty} ${targetItem.unit || 'Cái'}.`
      }
    }
    nextQty = currentQty - amount
    qtyChange = -amount
  } else if (input.txType === 'import') {
    nextQty = currentQty + amount
    qtyChange = amount
  } else {
    nextQty = amount
    qtyChange = amount - currentQty
  }

  const nowIso = new Date().toISOString()
  items[itemIdx] = {
    ...targetItem,
    quantity: nextQty,
    updated_at: nowIso
  }

  const txRecord: RawTransactionRecord = {
    id: `wh_tx_web_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    item_id: targetItem.id,
    bin_id: targetItem.bin_id,
    tx_type: input.txType,
    quantity_change: qtyChange,
    quantity_after: nextQty,
    target_department: (input.targetDepartment || 'Quét QR Điện thoại').trim(),
    performed_by: (input.performedBy || 'NV IT (Vercel QR)').trim(),
    note:
      (input.note || '').trim() ||
      (input.txType === 'export'
        ? `Xuất qua QR Mobile: ${targetItem.name}`
        : input.txType === 'import'
          ? `Nhập qua QR Mobile: ${targetItem.name}`
          : `Kiểm kê QR Mobile: ${targetItem.name}`),
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null
  }

  payload.warehouse_items = items
  payload.warehouse_transactions = [txRecord, ...(payload.warehouse_transactions || [])].slice(0, 500)
  payload.last_updated = nowIso

  if (cleanKey) {
    const keys = Array.isArray(payload.applied_keys) ? payload.applied_keys : []
    keys.push({
      key: cleanKey,
      item_id: targetItem.id,
      tx_type: input.txType,
      quantity_after: nextQty,
      created_at: nowIso
    })
    payload.applied_keys = keys.slice(-200)
  }

  const accessToken = await getAccessToken(key)
  const uploadUrl = `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true`
  const updateRes = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  })

  if (!updateRes.ok) {
    const errText = await updateRes.text()
    return {
      ok: false,
      statusCode: updateRes.status,
      error: `Không lưu được lên Google Drive (${updateRes.status}): ${errText}`
    }
  }

  return {
    ok: true,
    statusCode: 200,
    snapshot: buildWebSnapshot(payload)
  }
}

