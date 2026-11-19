'use client'

import React, { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type {
  EnrichedBin,
  EnrichedItem,
  LoadWarehouseResult,
  Warehouse5SStatus,
  WarehouseTxType,
  WebWarehouseSnapshot
} from '@/lib/types'

interface WarehouseMobileAppProps {
  initialResult: LoadWarehouseResult
  initialBinCode?: string
}

interface CustomAdjustState {
  item: EnrichedItem
  txType: WarehouseTxType
  amount: string
  department: string
}

/**
 * Tạo UUID duy nhất dùng cho Idempotency-Key chống gửi trùng khi mạng 4G chập chờn
 */
function createClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Ẩn ghi chú seed mặc định từ bảng thống kê kho để giữ card sản phẩm sạch gọn
 */
function isDefaultSeedNote(note?: string): boolean {
  if (!note) return true
  const trimmed = note.trim()
  if (!trimmed) return true
  return /^(Thùng|Nhóm|Kệ thùng)\s+[\w-]+\s*\(STT\s+\d+\s*[—-]\s*Bảng thống kê kho\)$/i.test(
    trimmed
  )
}

function getStatusMeta(status: Warehouse5SStatus): { label: string; badgeClass: string } {
  if (status === 'repair') {
    return {
      label: 'Chờ sửa / Kiểm tra',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35'
    }
  }
  if (status === 'scrap') {
    return {
      label: 'Hỏng / Thanh lý',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35'
    }
  }
  return {
    label: 'Dùng tốt',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
  }
}

function getRoomLabel(roomCode: string): string {
  return roomCode === 'working_room' ? 'Phòng Làm Việc IT' : 'Phòng Kho IT'
}

/**
 * WarehouseMobileApp: Giao diện Web Mobile siêu nhẹ phục vụ quét QR bằng Camera / Zalo
 * - Mở ngay danh sách thiết bị & số lượng tồn bên trong thùng
 * - Thao tác 1 chạm [-1 Lấy ra] / [+1 Nhập vào] / [SL khác...] (Không cần PIN, có Idempotency-Key)
 */
export const WarehouseMobileApp: React.FC<WarehouseMobileAppProps> = ({
  initialResult,
  initialBinCode
}) => {
  const [snapshot, setSnapshot] = useState<WebWarehouseSnapshot | null>(
    initialResult.snapshot || null
  )
  const [errorMsg, setErrorMsg] = useState<string>(initialResult.ok ? '' : initialResult.error || '')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null)
  const [customModal, setCustomModal] = useState<CustomAdjustState | null>(null)

  // Lưu khóa Idempotency-Key theo thao tác đang thực hiện
  const inflightKeyRef = useRef<Record<string, string>>({})

  const showToast = (text: string, isError = false): void => {
    setToast({ text, isError })
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev))
    }, 2600)
  }

  // Tìm thùng khớp với mã trên URL /b/[binCode] (không phân biệt hoa/thường)
  const activeBin: EnrichedBin | null = useMemo(() => {
    if (!snapshot || !initialBinCode) return null
    const clean = decodeURIComponent(initialBinCode).trim().toLowerCase()
    return (
      snapshot.bins.find(
        (b) => b.bin_code.toLowerCase() === clean || b.id.toLowerCase() === clean
      ) || null
    )
  }, [snapshot, initialBinCode])

  const filteredBins: EnrichedBin[] = useMemo(() => {
    if (!snapshot) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return snapshot.bins
    return snapshot.bins.filter((b) => {
      if (b.bin_code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)) return true
      return b.items.some(
        (it) =>
          it.name.toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q)
      )
    })
  }, [snapshot, searchQuery])

  // Tải lại dữ liệu mới nhất từ Google Drive
  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/warehouse', { cache: 'no-store' })
      const json = (await res.json()) as {
        ok: boolean
        data?: WebWarehouseSnapshot
        error?: string
      }
      if (!json.ok || !json.data) {
        throw new Error(json.error || 'Không thể tải dữ liệu mới nhất')
      }
      setSnapshot(json.data)
      setErrorMsg('')
      showToast('Đã đồng bộ số liệu mới nhất!')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Lỗi kết nối', true)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Gửi yêu cầu Xuất / Nhập / Kiểm kê lên Google Drive qua API
  const submitAdjust = async (
    item: EnrichedItem,
    txType: WarehouseTxType,
    amount: number,
    targetDepartment?: string
  ): Promise<boolean> => {
    if (busyItemId) return false
    setBusyItemId(item.id)

    if (!inflightKeyRef.current[item.id]) {
      inflightKeyRef.current[item.id] = createClientUuid()
    }
    const idempotencyKey = inflightKeyRef.current[item.id]

    try {
      const res = await fetch('/api/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          itemId: item.id,
          txType,
          amount,
          targetDepartment: targetDepartment?.trim() || 'Quét QR Điện thoại',
          performedBy: 'NV IT (Mobile QR)'
        })
      })

      const json = (await res.json()) as {
        ok: boolean
        data?: WebWarehouseSnapshot
        error?: string
      }

      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || 'Không thể cập nhật tồn kho')
      }

      setSnapshot(json.data)
      delete inflightKeyRef.current[item.id]

      const msg =
        txType === 'export'
          ? `Đã xuất −${amount} (${item.name})`
          : txType === 'import'
            ? `Đã nhập +${amount} (${item.name})`
            : `Đã kiểm kê "${item.name}" = ${amount}`
      showToast(msg)
      return true
    } catch (err: unknown) {
      delete inflightKeyRef.current[item.id]
      showToast(err instanceof Error ? err.message : 'Lỗi cập nhật', true)
      return false
    } finally {
      setBusyItemId(null)
    }
  }

  const binTransactions = useMemo(() => {
    if (!snapshot || !activeBin) return []
    return snapshot.transactions.filter((t) => t.bin_id === activeBin.id).slice(0, 8)
  }, [snapshot, activeBin])

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 pb-14">
      {/* Topbar ghim đầu trang trên điện thoại */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            BVĐK Tân Hưng • Tổ CNTT
          </div>
          <h1 className="text-sm font-extrabold truncate">Kho Thiết Bị &amp; Vật Tư IT</h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {initialBinCode && (
            <Link
              href="/"
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-zinc-200"
            >
              Tất cả thùng
            </Link>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-zinc-200 disabled:opacity-50 cursor-pointer"
          >
            {isRefreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </header>

      <main className="w-full max-w-xl mx-auto px-3.5 pt-3.5 space-y-3.5 flex-1">
        {/* Thông báo lỗi cấu hình / chưa khởi tạo tệp Drive */}
        {errorMsg && !snapshot && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200 space-y-2">
            <div className="font-bold text-rose-300">Chưa kết nối được dữ liệu Kho IT</div>
            <p className="text-xs leading-relaxed text-rose-200/90">{errorMsg}</p>
          </div>
        )}

        {/* CHẾ ĐỘ 1: XEM CHI TIẾT 1 THÙNG KHI QUÉT MÃ QR (/b/THUNG-01) */}
        {snapshot && initialBinCode && !activeBin && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/25 p-4 text-center space-y-2">
            <div className="font-bold text-amber-300 text-sm">
              Không tìm thấy thùng mã &ldquo;{decodeURIComponent(initialBinCode)}&rdquo;
            </div>
            <Link
              href="/"
              className="inline-block px-3.5 py-1.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold"
            >
              Xem tất cả thùng trong Kho
            </Link>
          </div>
        )}

        {snapshot && activeBin && (
          <>
            {/* Khối thông tin đầu Thùng */}
            <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/70 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-950 font-mono font-black text-sm">
                    {activeBin.bin_code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                      getStatusMeta(activeBin.status_5s).badgeClass
                    }`}
                  >
                    {getStatusMeta(activeBin.status_5s).label}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Cập nhật: {new Date(snapshot.lastUpdated).toLocaleTimeString('vi-VN')}
                </span>
              </div>

              <div>
                <h2 className="text-lg font-extrabold leading-snug text-white">{activeBin.name}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {getRoomLabel(activeBin.room_code)} • {activeBin.zone_name} • Tầng{' '}
                  {activeBin.tier_number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                  <div className="text-[11px] text-zinc-400">Số mặt hàng</div>
                  <div className="text-lg font-black font-mono text-white">
                    {activeBin.items.length} loại
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                  <div className="text-[11px] text-zinc-400">Tổng số lượng tồn</div>
                  <div className="text-lg font-black font-mono text-emerald-400">
                    {activeBin.total_quantity} đơn vị
                  </div>
                </div>
              </div>
            </section>

            {/* Danh sách thiết bị / vật tư bên trong thùng */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Thiết bị / Vật tư bên trong
                </span>
                <span className="text-[11px] text-zinc-500">Chạm để Xuất / Nhập</span>
              </div>

              {activeBin.items.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-xs text-zinc-400">
                  Thùng này hiện đang trống.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeBin.items.map((item, idx) => {
                    const qty = Number(item.quantity) || 0
                    const isZero = qty <= 0
                    const isBusy = busyItemId === item.id
                    const hasCustomNote = !isDefaultSeedNote(item.note)

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3.5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-extrabold text-white leading-snug">
                              {idx + 1}. {item.name}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {item.category || 'Vật tư IT'}
                              {hasCustomNote ? ` • ${item.note}` : ''}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-right min-w-[78px]">
                            <div
                              className={`font-mono text-xl font-black leading-none ${
                                isZero ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {qty}
                            </div>
                            <div className="text-[10px] font-semibold text-zinc-400 mt-0.5">
                              {item.unit || 'Cái'}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-zinc-800">
                          <button
                            type="button"
                            disabled={isZero || isBusy}
                            onClick={() => submitAdjust(item, 'export', 1)}
                            className="py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-35 text-rose-300 text-xs font-extrabold cursor-pointer active:scale-95 transition-all"
                          >
                            {isBusy ? '...' : '−1 Lấy ra'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => submitAdjust(item, 'import', 1)}
                            className="py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-35 text-emerald-300 text-xs font-extrabold cursor-pointer active:scale-95 transition-all"
                          >
                            {isBusy ? '...' : '+1 Nhập vào'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              setCustomModal({
                                item,
                                txType: 'export',
                                amount: '1',
                                department: ''
                              })
                            }
                            className="py-2 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer active:scale-95 transition-all"
                          >
                            SL khác...
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Lịch sử xuất nhập gần đây của thùng */}
            {binTransactions.length > 0 && (
              <section className="space-y-2 pt-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 px-1">
                  Lịch sử gần đây
                </div>
                <div className="space-y-1.5">
                  {binTransactions.map((tx) => {
                    const isPositive = tx.quantity_change > 0
                    return (
                      <div
                        key={tx.id}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-200 truncate">{tx.item_name}</div>
                          <div className="text-[10px] text-zinc-400 truncate">
                            {tx.target_department ? `${tx.target_department} • ` : ''}
                            {new Date(tx.created_at).toLocaleString('vi-VN')}
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-mono font-bold">
                          <div className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                            {isPositive ? `+${tx.quantity_change}` : tx.quantity_change}
                          </div>
                          <div className="text-[10px] text-zinc-500">Còn {tx.quantity_after}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* CHẾ ĐỘ 2: TRANG CHỦ TRA CỨU TOÀN BỘ THÙNG & TÌM VẬT TƯ (/) */}
        {snapshot && !initialBinCode && (
          <>
            <div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhanh vật tư / mã thùng (VD: VGA, Adapter, THUNG-06)..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
              <span>Danh sách {filteredBins.length} thùng Kho IT</span>
              <span>Chạm để mở thùng</span>
            </div>

            <div className="space-y-2.5">
              {filteredBins.map((bin) => {
                const statusMeta = getStatusMeta(bin.status_5s)
                return (
                  <Link
                    key={bin.id}
                    href={`/b/${encodeURIComponent(bin.bin_code)}`}
                    className="block rounded-2xl border border-zinc-800 bg-zinc-900/90 hover:border-zinc-600 p-3.5 space-y-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-950 font-mono font-black text-xs shrink-0">
                          {bin.bin_code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold truncate ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                        {bin.items.length} món • SL: {bin.total_quantity}
                      </span>
                    </div>

                    <div className="text-sm font-extrabold text-white">{bin.name}</div>
                    <div className="text-[11px] text-zinc-400">
                      {getRoomLabel(bin.room_code)} • {bin.zone_name} • Tầng {bin.tier_number}
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </main>

      {/* Modal nhập số lượng tùy chọn (Thân thiện trên Mobile & Zalo In-App Browser) */}
      {customModal && (
        <div
          onClick={() => setCustomModal(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault()
              const num = parseInt(customModal.amount, 10)
              if (Number.isNaN(num)) {
                showToast('Vui lòng nhập số lượng hợp lệ', true)
                return
              }
              const ok = await submitAdjust(
                customModal.item,
                customModal.txType,
                num,
                customModal.department
              )
              if (ok) setCustomModal(null)
            }}
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold text-sm text-white truncate">
                {customModal.item.name}
              </div>
              <span className="text-xs font-mono text-emerald-400 shrink-0">
                Hiện có: {customModal.item.quantity} {customModal.item.unit || 'Cái'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCustomModal({ ...customModal, txType: 'export' })}
                className={`py-1.5 rounded-lg cursor-pointer ${
                  customModal.txType === 'export'
                    ? 'bg-rose-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Xuất đi khoa
              </button>
              <button
                type="button"
                onClick={() => setCustomModal({ ...customModal, txType: 'import' })}
                className={`py-1.5 rounded-lg cursor-pointer ${
                  customModal.txType === 'import'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Nhập thêm
              </button>
              <button
                type="button"
                onClick={() =>
                  setCustomModal({
                    ...customModal,
                    txType: 'adjust',
                    amount: String(customModal.item.quantity)
                  })
                }
                className={`py-1.5 rounded-lg cursor-pointer ${
                  customModal.txType === 'adjust'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Kiểm kê SL
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">
                {customModal.txType === 'adjust'
                  ? 'Số lượng thực tế đang đếm được trong thùng:'
                  : 'Số lượng cần thay đổi:'}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={customModal.txType === 'adjust' ? 0 : 1}
                required
                value={customModal.amount}
                onChange={(e) => setCustomModal({ ...customModal, amount: e.target.value })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base font-mono font-bold text-white outline-none focus:border-emerald-500"
              />

              <label className="block text-xs text-zinc-400 pt-1">
                Khoa / Phòng nhận (tùy chọn):
              </label>
              <input
                type="text"
                value={customModal.department}
                onChange={(e) => setCustomModal({ ...customModal, department: e.target.value })}
                placeholder="VD: Khoa Nội 1, Quầy Thu Ngân..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCustomModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busyItemId !== null}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white cursor-pointer disabled:opacity-50"
              >
                {busyItemId ? 'Đang lưu...' : 'Xác nhận lưu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast thông báo nổi */}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-extrabold shadow-xl max-w-[90vw] truncate ${
            toast.isError ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-zinc-950'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}

