import type {
  BatchAdjustChangeItem,
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
 * Làm sạch chuỗi khóa môi trường (loại bỏ tiền tố tên biến hoặc dấu ngoặc kép/đơn nếu người dùng copy thừa)
 */
function sanitizeEnvRaw(rawValue: string): string {
  let clean = rawValue.trim()
  if (clean.startsWith('WIKIHIS_DRIVE_KEY=')) {
    clean = clean.slice('WIKIHIS_DRIVE_KEY='.length).trim()
  }
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim()
  }
  return clean.replace(/\s+/g, '')
}

/**
 * Giải mã biến môi trường WIKIHIS_DRIVE_KEY (Base64 JSON) được copy từ WikiHIS Desktop
 */
function parseDriveKey(): { key: DecodedDriveKey | null; status: 'ok' | 'missing' | 'invalid' } {
  const raw = process.env.WIKIHIS_DRIVE_KEY?.trim()
  if (!raw) return { key: null, status: 'missing' }

  const sanitized = sanitizeEnvRaw(raw)
  if (!sanitized) return { key: null, status: 'missing' }

  try {
    const jsonText = raw.trim().startsWith('{')
      ? raw.trim()
      : Buffer.from(sanitized, 'base64').toString('utf-8')
    const parsed = JSON.parse(jsonText) as Partial<DecodedDriveKey>
    if (!parsed.client_id || !parsed.client_secret || !parsed.refresh_token) {
      return { key: null, status: 'invalid' }
    }
    return { key: parsed as DecodedDriveKey, status: 'ok' }
  } catch {
    return { key: null, status: 'invalid' }
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
  const parsed = parseDriveKey()
  if (!parsed.key) {
    return {
      ok: false,
      missingEnv: true,
      error:
        parsed.status === 'invalid'
          ? 'Giá trị biến WIKIHIS_DRIVE_KEY trên Vercel không đúng định dạng (có thể bị thiếu ký tự hoặc dính khoảng trắng). Hãy copy lại từ WikiHIS Desktop.'
          : 'Chưa cấu hình biến môi trường WIKIHIS_DRIVE_KEY trên Vercel (hoặc đã thêm nhưng chưa bấm Redeploy).'
    }
  }
  const key = parsed.key

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
 * Thực thi giao dịch Xuất / Nhập / Kiểm kê HÀNG LOẠT (nguyên tử All-or-Nothing) và ghi 1 lần duy nhất vào db/warehouse_live.json
 * - Đọc file 1 lần, kiểm tra toàn bộ thay đổi trên bản sao trước khi ghi để không bao giờ bị lưu dở dang
 * - Bảo vệ chống bấm đúp / mạng 4G chập chờn bằng 1 khóa `Idempotency-Key` cho cả lô thay đổi
 */
export async function adjustWarehouseBatchOnDrive(input: {
  changes: BatchAdjustChangeItem[]
  targetDepartment?: string
  performedBy?: string
  note?: string
  idempotencyKey?: string
}): Promise<{
  ok: boolean
  idempotent?: boolean
  appliedCount?: number
  statusCode: number
  error?: string
  snapshot?: WebWarehouseSnapshot
}> {
  const parsed = parseDriveKey()
  if (!parsed.key) {
    return {
      ok: false,
      statusCode: 500,
      error:
        parsed.status === 'invalid'
          ? 'Biến môi trường WIKIHIS_DRIVE_KEY trên server không hợp lệ.'
          : 'Thiếu biến môi trường WIKIHIS_DRIVE_KEY trên server.'
    }
  }
  const key = parsed.key

  if (!Array.isArray(input.changes) || input.changes.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Không có sản phẩm nào cần cập nhật số lượng.'
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

  // Kiểm tra Idempotency-Key tránh cộng/trừ kho 2 lần khi mạng 4G chập chờn hoặc bấm gửi đúp
  if (cleanKey && Array.isArray(payload.applied_keys)) {
    const existed = payload.applied_keys.find((k) => k.key === cleanKey)
    if (existed) {
      return {
        ok: true,
        idempotent: true,
        appliedCount: 0,
        statusCode: 200,
        snapshot: buildWebSnapshot(payload)
      }
    }
  }

  // Tạo bản sao danh sách sản phẩm để kiểm tra & tính toán toàn bộ lô trước khi ghi thật (All-or-Nothing)
  const workingItems = [...(payload.warehouse_items || [])]
  const newTransactions: RawTransactionRecord[] = []
  const nowIso = new Date().toISOString()
  const baseTs = Date.now()
  const cleanDepartment = (input.targetDepartment || 'Quét QR Điện thoại').trim()
  const cleanPerformedBy = (input.performedBy || 'NV IT (Vercel QR)').trim()
  const batchNote = (input.note || '').trim()

  let lastAppliedSummary: { itemId: string; txType: WarehouseTxType; nextQty: number } | null = null

  for (let idx = 0; idx < input.changes.length; idx++) {
    const change = input.changes[idx]
    const amount = Math.floor(Number(change.amount) || 0)

    if ((change.txType === 'export' || change.txType === 'import') && amount <= 0) {
      return { ok: false, statusCode: 400, error: 'Số lượng Xuất / Nhập phải lớn hơn 0.' }
    }
    if (change.txType === 'adjust' && amount < 0) {
      return { ok: false, statusCode: 400, error: 'Số lượng kiểm kê không thể âm.' }
    }

    const itemIdx = workingItems.findIndex((it) => it.id === change.itemId && !it.deleted_at)
    if (itemIdx === -1) {
      return {
        ok: false,
        statusCode: 404,
        error: 'Có sản phẩm không còn tồn tại trong thùng (vui lòng bấm Làm mới để đồng bộ lại).'
      }
    }

    const targetItem = workingItems[itemIdx]
    const currentQty = Number(targetItem.quantity) || 0
    let nextQty = currentQty
    let qtyChange = 0

    if (change.txType === 'export') {
      if (amount > currentQty) {
        return {
          ok: false,
          statusCode: 400,
          error: `Không đủ tồn kho cho "${targetItem.name}": hiện chỉ còn ${currentQty} ${targetItem.unit || 'Cái'}.`
        }
      }
      nextQty = currentQty - amount
      qtyChange = -amount
    } else if (change.txType === 'import') {
      nextQty = currentQty + amount
      qtyChange = amount
    } else {
      nextQty = amount
      qtyChange = amount - currentQty
      // Nếu số lượng kiểm kê trùng khớp tồn hiện tại thì bỏ qua để không tạo dòng lịch sử 0
      if (qtyChange === 0) continue
    }

    workingItems[itemIdx] = {
      ...targetItem,
      quantity: nextQty,
      updated_at: nowIso
    }

    const itemNote = (change.note || batchNote).trim()
    const defaultNote =
      change.txType === 'export'
        ? `Xuất qua QR Mobile: ${targetItem.name}`
        : change.txType === 'import'
          ? `Nhập qua QR Mobile: ${targetItem.name}`
          : `Kiểm kê QR Mobile: ${targetItem.name}`

    newTransactions.push({
      id: `wh_tx_web_${baseTs}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      item_id: targetItem.id,
      bin_id: targetItem.bin_id,
      tx_type: change.txType,
      quantity_change: qtyChange,
      quantity_after: nextQty,
      target_department: cleanDepartment,
      performed_by: cleanPerformedBy,
      note: itemNote || defaultNote,
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null
    })

    lastAppliedSummary = {
      itemId: targetItem.id,
      txType: change.txType,
      nextQty
    }
  }

  // Nếu toàn bộ thay đổi đều không làm đổi số lượng thực tế thì trả snapshot ngay, không tốn 1 lượt ghi Drive
  if (newTransactions.length === 0) {
    return {
      ok: true,
      appliedCount: 0,
      statusCode: 200,
      snapshot: buildWebSnapshot(payload)
    }
  }

  // Đảo thứ tự nhẹ để mục đầu tiên trong lô hiện ở đầu lịch sử gần nhất
  payload.warehouse_items = workingItems
  payload.warehouse_transactions = [
    ...newTransactions,
    ...(payload.warehouse_transactions || [])
  ].slice(0, 500)
  payload.last_updated = nowIso

  if (cleanKey && lastAppliedSummary) {
    const keys = Array.isArray(payload.applied_keys) ? payload.applied_keys : []
    keys.push({
      key: cleanKey,
      item_id:
        newTransactions.length === 1
          ? lastAppliedSummary.itemId
          : `batch:${newTransactions.length}`,
      tx_type: newTransactions.length === 1 ? lastAppliedSummary.txType : 'batch',
      quantity_after:
        newTransactions.length === 1 ? lastAppliedSummary.nextQty : newTransactions.length,
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
    appliedCount: newTransactions.length,
    statusCode: 200,
    snapshot: buildWebSnapshot(payload)
  }
}

/**
 * Thực thi giao dịch Xuất / Nhập / Kiểm kê đơn lẻ (giữ tương thích ngược, ủy quyền sang luồng Batch nguyên tử)
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
  return adjustWarehouseBatchOnDrive({
    changes: [
      {
        itemId: input.itemId,
        txType: input.txType,
        amount: input.amount,
        note: input.note
      }
    ],
    targetDepartment: input.targetDepartment,
    performedBy: input.performedBy,
    note: input.note,
    idempotencyKey: input.idempotencyKey
  })
}

