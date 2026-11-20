'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import type {
  BatchAdjustChangeItem,
  DraftItemEdit,
  EnrichedBin,
  EnrichedItem,
  LoadWarehouseResult,
  PendingQuantityChange,
  WarehouseTxType,
  WebWarehouseSnapshot
} from '@/lib/types'
import { BatchConfirmModal } from './BatchConfirmModal'
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

type DiscardPromptAction = 'refresh' | 'home' | null

/**
 * WarehouseMobileApp: Bộ điều phối giao diện Website Kho IT theo chuẩn Clean Clinical Light (taste-skill)
 * - Cho phép chỉnh sửa HÀNG LOẠT số lượng sản phẩm trong thùng trên bản nháp cục bộ
 * - Bấm Lưu -> Mở Hộp thoại xác nhận lần 2 -> Gửi 1 yêu cầu Batch duy nhất kèm Idempotency-Key chống gửi trùng
 */
export const WarehouseMobileApp: React.FC<WarehouseMobileAppProps> = ({
  initialResult,
  initialBinCode
}) => {
  const router = useRouter()

  const [snapshot, setSnapshot] = useState<WebWarehouseSnapshot | null>(
    initialResult.snapshot || null
  )
  const [errorMsg, setErrorMsg] = useState<string>(initialResult.ok ? '' : initialResult.error || '')
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null)
  const [customItem, setCustomItem] = useState<EnrichedItem | null>(null)

  // Trạng thái chỉnh sửa hàng loạt (chỉ lưu nháp trên trình duyệt, chưa gửi API)
  const [draftMap, setDraftMap] = useState<Record<string, DraftItemEdit>>({})
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false)
  const [batchDepartment, setBatchDepartment] = useState<string>('')
  const [batchError, setBatchError] = useState<string | null>(null)
  const [isSavingBatch, setIsSavingBatch] = useState<boolean>(false)
  const [discardPromptAction, setDiscardPromptAction] = useState<DiscardPromptAction>(null)

  // Sinh 1 khóa Idempotency-Key duy nhất mỗi khi mở Modal Xác nhận (không sinh lại trong hàm onClick nút Lưu)
  const batchIdempotencyKeyRef = useRef<string | null>(null)

  const showToast = (text: string, isError = false): void => {
    setToast({ text, isError })
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev))
    }, 2800)
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

  // Tính danh sách các sản phẩm thực sự thay đổi số lượng (Cũ -> Mới) để hiển thị thanh Lưu & Modal Xác nhận
  const pendingChanges: PendingQuantityChange[] = useMemo(() => {
    if (!activeBin) return []
    const list: PendingQuantityChange[] = []
    for (const item of activeBin.items) {
      const draft = draftMap[item.id]
      if (!draft) continue

      const originalQty = Number(item.quantity) || 0
      const draftQty = Math.max(0, Math.floor(draft.quantity))
      const delta = draftQty - originalQty
      if (delta === 0) continue

      // Nếu người dùng chủ động chọn tab Kiểm kê -> gửi txType='adjust'; ngược lại dùng export/import để an toàn đồng thời
      let txType: WarehouseTxType
      let apiAmount: number
      if (draft.mode === 'adjust') {
        txType = 'adjust'
        apiAmount = draftQty
      } else if (delta < 0) {
        txType = 'export'
        apiAmount = Math.abs(delta)
      } else {
        txType = 'import'
        apiAmount = delta
      }

      list.push({
        item,
        originalQty,
        draftQty,
        delta,
        txType,
        apiAmount
      })
    }
    return list
  }, [activeBin, draftMap])

  const hasUnsavedChanges = pendingChanges.length > 0

  // Cảnh báo trình duyệt nếu người dùng lỡ bấm tải lại trang / đóng tab khi đang có nháp chưa lưu
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // Cập nhật 1 món vào bản nháp (nếu số mới quay về bằng tồn gốc thì tự gỡ khỏi nháp)
  const updateItemDraft = (item: EnrichedItem, nextQty: number, mode: 'delta' | 'adjust'): void => {
    const safeQty = Math.max(0, Math.floor(nextQty))
    const originalQty = Number(item.quantity) || 0

    // Thay đổi nội dung nháp -> vô hiệu hóa Idempotency-Key cũ để lần mở xác nhận mới sinh khóa mới
    batchIdempotencyKeyRef.current = null
    setBatchError(null)

    setDraftMap((prev) => {
      if (safeQty === originalQty) {
        if (!(item.id in prev)) return prev
        const next = { ...prev }
        delete next[item.id]
        return next
      }
      return {
        ...prev,
        [item.id]: { quantity: safeQty, mode }
      }
    })
  }

  // Tăng / giảm 1 đơn vị ngay trên bản nháp (không gọi API)
  const handleStepDraft = (item: EnrichedItem, delta: number): void => {
    const currentWorkingQty = draftMap[item.id]?.quantity ?? (Number(item.quantity) || 0)
    const nextQty = Math.max(0, currentWorkingQty + delta)
    updateItemDraft(item, nextQty, 'delta')
  }

  // Hoàn tác riêng 1 sản phẩm về số lượng gốc
  const handleRevertItem = (itemId: string): void => {
    batchIdempotencyKeyRef.current = null
    setBatchError(null)
    setDraftMap((prev) => {
      if (!(itemId in prev)) return prev
      const next = { ...prev }
      delete next[itemId]
      // Nếu hoàn tác hết mọi món trong khi đang mở modal xác nhận thì tự đóng modal
      if (Object.keys(next).length === 0) {
        setIsConfirmModalOpen(false)
      }
      return next
    })
  }

  // Hủy toàn bộ thay đổi nháp hiện tại
  const handleDiscardAllDrafts = (): void => {
    batchIdempotencyKeyRef.current = null
    setDraftMap({})
    setBatchError(null)
    setIsConfirmModalOpen(false)
  }

  // Mở Bước xác nhận lần 2 và sinh sẵn 1 khóa Idempotency-Key cho lô lưu này
  const handleOpenConfirmModal = (): void => {
    if (pendingChanges.length === 0) return
    if (!batchIdempotencyKeyRef.current) {
      batchIdempotencyKeyRef.current = createClientUuid()
    }
    setBatchError(null)
    setIsConfirmModalOpen(true)
  }

  // Thực thi tải lại dữ liệu mới nhất từ Google Drive qua API /api/warehouse
  const executeRefresh = async (): Promise<void> => {
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
      handleDiscardAllDrafts()
      showToast('Đã đồng bộ số liệu mới nhất!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối'
      if (!snapshot) setErrorMsg(msg)
      showToast(msg, true)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Kiểm tra nháp chưa lưu trước khi Làm mới hoặc Quay về Kho tổng
  const handleRequestRefresh = (): void => {
    if (hasUnsavedChanges) {
      setDiscardPromptAction('refresh')
      return
    }
    void executeRefresh()
  }

  const handleRequestNavigateHome = (): void => {
    if (hasUnsavedChanges) {
      setDiscardPromptAction('home')
      return
    }
    router.push('/')
  }

  const handleConfirmDiscardAction = (): void => {
    const action = discardPromptAction
    setDiscardPromptAction(null)
    if (action === 'refresh') {
      void executeRefresh()
    } else if (action === 'home') {
      handleDiscardAllDrafts()
      router.push('/')
    }
  }

  // Gửi 1 request Batch duy nhất lên Backend /api/adjust sau khi người dùng đã xác nhận lần 2
  const handleConfirmBatchSave = async (): Promise<void> => {
    if (isSavingBatch || pendingChanges.length === 0) return
    setIsSavingBatch(true)
    setBatchError(null)

    const idempotencyKey = batchIdempotencyKeyRef.current || createClientUuid()
    batchIdempotencyKeyRef.current = idempotencyKey

    const changesPayload: BatchAdjustChangeItem[] = pendingChanges.map((ch) => ({
      itemId: ch.item.id,
      txType: ch.txType,
      amount: ch.apiAmount
    }))

    try {
      const res = await fetch('/api/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          changes: changesPayload,
          targetDepartment: batchDepartment.trim() || 'Quét QR Điện thoại',
          performedBy: 'NV IT (Mobile QR)'
        })
      })

      const json = (await res.json()) as {
        ok: boolean
        appliedCount?: number
        data?: WebWarehouseSnapshot
        error?: string
      }

      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || 'Không thể lưu cập nhật tồn kho')
      }

      const savedCount = json.appliedCount ?? changesPayload.length
      setSnapshot(json.data)
      setDraftMap({})
      setBatchDepartment('')
      setIsConfirmModalOpen(false)
      batchIdempotencyKeyRef.current = null
      showToast(`Đã lưu thành công ${savedCount} sản phẩm!`)
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Lỗi kết nối khi lưu tồn kho'
      // Giữ nguyên batchIdempotencyKeyRef và draftMap để bấm Thử lại không bị mất nháp hay trừ 2 lần
      setBatchError(errText)
    } finally {
      setIsSavingBatch(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f9fafb] text-zinc-900 pb-12">
      <WarehouseHeader
        showBackHome={Boolean(initialBinCode)}
        isRefreshing={isRefreshing}
        onRefresh={handleRequestRefresh}
        onNavigateHome={hasUnsavedChanges ? handleRequestNavigateHome : undefined}
      />

      <main className="w-full max-w-xl mx-auto px-3.5 pt-3 flex-1">
        {/* Trường hợp 1: Chưa kết nối được Google Drive / thiếu biến Vercel */}
        {errorMsg && !snapshot && (
          <ConnectionErrorCard
            errorMsg={errorMsg}
            isRefreshing={isRefreshing}
            onRetry={handleRequestRefresh}
          />
        )}

        {/* Trường hợp 2: Quét mã thùng không tồn tại */}
        {snapshot && initialBinCode && !activeBin && (
          <section className="rounded-lg border border-zinc-300 bg-white p-6 text-center space-y-3">
            <div className="text-sm font-bold text-zinc-900">
              Không tìm thấy thùng mã &ldquo;{decodeURIComponent(initialBinCode)}&rdquo;
            </div>
            <p className="text-xs text-zinc-500">
              Thùng này có thể vừa được đổi mã hoặc chưa đồng bộ từ WikiHIS Desktop.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold"
            >
              Xem danh sách tất cả thùng
            </Link>
          </section>
        )}

        {/* Trường hợp 3: Chi tiết 1 thùng khi quét QR (/b/[binCode]) — hỗ trợ chỉnh nháp hàng loạt */}
        {snapshot && activeBin && (
          <BinDetailView
            bin={activeBin}
            lastUpdated={snapshot.lastUpdated}
            transactions={binTransactions}
            draftMap={draftMap}
            pendingChanges={pendingChanges}
            isSavingBatch={isSavingBatch}
            onStepDraft={handleStepDraft}
            onOpenCustomModal={(item) => setCustomItem(item)}
            onRevertItem={handleRevertItem}
            onDiscardAll={handleDiscardAllDrafts}
            onRequestConfirmSave={handleOpenConfirmModal}
          />
        )}

        {/* Trường hợp 4: Trang chủ tra cứu toàn kho (/) */}
        {snapshot && !initialBinCode && <BinCatalogView bins={snapshot.bins} />}
      </main>

      {/* Modal nhập số lượng tùy chỉnh / kiểm kê vào bản nháp */}
      {customItem && (
        <CustomAdjustModal
          item={customItem}
          currentDraftQty={draftMap[customItem.id]?.quantity ?? (Number(customItem.quantity) || 0)}
          onClose={() => setCustomItem(null)}
          onApplyDraft={updateItemDraft}
        />
      )}

      {/* Modal Xác nhận lần 2 trước khi gửi yêu cầu Batch API lên Google Drive */}
      {isConfirmModalOpen && activeBin && pendingChanges.length > 0 && (
        <BatchConfirmModal
          binCode={activeBin.bin_code}
          binName={activeBin.name}
          changes={pendingChanges}
          department={batchDepartment}
          isSubmitting={isSavingBatch}
          submitError={batchError}
          onChangeDepartment={setBatchDepartment}
          onRevertSingleItem={handleRevertItem}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirmSave={() => void handleConfirmBatchSave()}
        />
      )}

      {/* Hộp thoại cảnh báo khi bấm Làm mới hoặc rời thùng lúc còn thay đổi chưa lưu */}
      {discardPromptAction && (
        <div
          onClick={() => setDiscardPromptAction(null)}
          className="fixed inset-0 z-50 bg-zinc-950/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-start gap-2.5">
              <WarningCircle className="w-5 h-5 text-zinc-900 shrink-0 mt-0.5" weight="fill" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900">
                  Còn {pendingChanges.length} món chưa lưu
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {discardPromptAction === 'refresh'
                    ? 'Nếu bấm Làm mới ngay bây giờ, các số lượng bạn đang chỉnh nháp sẽ bị hủy bỏ.'
                    : 'Nếu quay về Kho tổng ngay bây giờ, các số lượng bạn đang chỉnh nháp sẽ bị hủy bỏ.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDiscardPromptAction(null)}
                className="h-9 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-800 cursor-pointer"
              >
                Ở lại chỉnh tiếp
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscardAction}
                className="h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white cursor-pointer"
              >
                {discardPromptAction === 'refresh' ? 'Bỏ nháp & Làm mới' : 'Bỏ nháp & Rời đi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo phản hồi nhanh phong cách Bill trắng đen */}
      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-lg text-xs font-bold shadow-lg max-w-[92vw] inline-flex items-center gap-2 border ${
            hasUnsavedChanges ? 'bottom-16' : 'bottom-4'
          } ${
            toast.isError
              ? 'bg-white border-zinc-900 text-zinc-900'
              : 'bg-zinc-900 border-zinc-900 text-white'
          }`}
        >
          {toast.isError ? (
            <WarningCircle className="w-4 h-4 text-zinc-900 shrink-0" weight="fill" />
          ) : (
            <CheckCircle className="w-4 h-4 text-white shrink-0" weight="fill" />
          )}
          <span className="truncate">{toast.text}</span>
        </div>
      )}
    </div>
  )
}
