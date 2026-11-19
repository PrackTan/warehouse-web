'use client'

import React, { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import type {
  EnrichedBin,
  EnrichedItem,
  LoadWarehouseResult,
  WarehouseTxType,
  WebWarehouseSnapshot
} from '@/lib/types'
import { BinCatalogView } from './BinCatalogView'
import { BinDetailView } from './BinDetailView'
import { ConnectionErrorCard } from './ConnectionErrorCard'
import { CustomAdjustModal } from './CustomAdjustModal'
import { WarehouseHeader } from './WarehouseHeader'
import { createClientUuid } from './warehouseUiUtils'

interface WarehouseMobileAppProps {
  initialResult: LoadWarehouseResult
  initialBinCode?: string
}

/**
 * WarehouseMobileApp: Bộ điều phối giao diện Website Kho IT theo chuẩn Clean Clinical Light (taste-skill)
 * - Quản lý snapshot kho đồng bộ từ Google Drive, xử lý Xuất/Nhập kèm Idempotency-Key chống trùng lặp
 */
export const WarehouseMobileApp: React.FC<WarehouseMobileAppProps> = ({
  initialResult,
  initialBinCode
}) => {
  const [snapshot, setSnapshot] = useState<WebWarehouseSnapshot | null>(
    initialResult.snapshot || null
  )
  const [errorMsg, setErrorMsg] = useState<string>(initialResult.ok ? '' : initialResult.error || '')
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null)
  const [customItem, setCustomItem] = useState<EnrichedItem | null>(null)

  // Lưu khóa Idempotency-Key theo từng món đồ đang gửi để chống trừ kho 2 lần khi mạng yếu
  const inflightKeyRef = useRef<Record<string, string>>({})

  const showToast = (text: string, isError = false): void => {
    setToast({ text, isError })
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev))
    }, 2600)
  }

  // Tìm thùng khớp chính xác với mã trên URL /b/[binCode] (không phân biệt hoa/thường)
  const activeBin: EnrichedBin | null = useMemo(() => {
    if (!snapshot || !initialBinCode) return null
    const clean = decodeURIComponent(initialBinCode).trim().toLowerCase()
    return (
      snapshot.bins.find(
        (b) => b.bin_code.toLowerCase() === clean || b.id.toLowerCase() === clean
      ) || null
    )
  }, [snapshot, initialBinCode])

  const binTransactions = useMemo(() => {
    if (!snapshot || !activeBin) return []
    return snapshot.transactions.filter((t) => t.bin_id === activeBin.id).slice(0, 8)
  }, [snapshot, activeBin])

  // Tải lại dữ liệu mới nhất từ Google Drive qua API /api/warehouse
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
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối'
      if (!snapshot) setErrorMsg(msg)
      showToast(msg, true)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Gửi yêu cầu Xuất / Nhập / Kiểm kê lên Google Drive qua API /api/adjust
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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f9fafb] text-zinc-900 pb-16">
      <WarehouseHeader
        showBackHome={Boolean(initialBinCode)}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      <main className="w-full max-w-4xl mx-auto px-4 pt-4 flex-1">
        {/* Trường hợp 1: Chưa kết nối được Google Drive / thiếu biến Vercel */}
        {errorMsg && !snapshot && (
          <ConnectionErrorCard
            errorMsg={errorMsg}
            isRefreshing={isRefreshing}
            onRetry={handleRefresh}
          />
        )}

        {/* Trường hợp 2: Quét mã thùng không tồn tại */}
        {snapshot && initialBinCode && !activeBin && (
          <section className="rounded-2xl border border-amber-200 bg-white p-6 text-center space-y-3 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.06)]">
            <div className="text-sm font-bold text-zinc-900">
              Không tìm thấy thùng mã &ldquo;{decodeURIComponent(initialBinCode)}&rdquo;
            </div>
            <p className="text-xs text-slate-500">
              Thùng này có thể vừa được đổi mã hoặc chưa đồng bộ từ WikiHIS Desktop.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Xem danh sách tất cả thùng
            </Link>
          </section>
        )}

        {/* Trường hợp 3: Chi tiết 1 thùng khi quét QR (/b/[binCode]) */}
        {snapshot && activeBin && (
          <BinDetailView
            bin={activeBin}
            lastUpdated={snapshot.lastUpdated}
            transactions={binTransactions}
            busyItemId={busyItemId}
            onQuickAdjust={submitAdjust}
            onOpenCustomModal={(item) => setCustomItem(item)}
          />
        )}

        {/* Trường hợp 4: Trang chủ tra cứu toàn kho (/) */}
        {snapshot && !initialBinCode && <BinCatalogView bins={snapshot.bins} />}
      </main>

      {/* Modal nhập số lượng tùy chỉnh / kiểm kê */}
      {customItem && (
        <CustomAdjustModal
          item={customItem}
          isSubmitting={busyItemId !== null}
          onClose={() => setCustomItem(null)}
          onSubmit={submitAdjust}
        />
      )}

      {/* Toast thông báo phản hồi nhanh */}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-bold shadow-lg max-w-[92vw] inline-flex items-center gap-2 ${
            toast.isError ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-white'
          }`}
        >
          {toast.isError ? (
            <WarningCircle className="w-4 h-4 text-rose-200 shrink-0" weight="fill" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" weight="fill" />
          )}
          <span className="truncate">{toast.text}</span>
        </div>
      )}
    </div>
  )
}
