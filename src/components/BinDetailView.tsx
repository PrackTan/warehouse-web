'use client'

import React, { useState } from 'react'
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  ClockCounterClockwise,
  FloppyDisk,
  Minus,
  Package,
  Plus
} from '@phosphor-icons/react'
import type {
  DraftItemEdit,
  EnrichedBin,
  EnrichedItem,
  EnrichedTransaction,
  PendingQuantityChange
} from '@/lib/types'
import { getRoomLabel, getStatusMeta, isDefaultSeedNote } from './warehouseUiUtils'

interface BinDetailViewProps {
  bin: EnrichedBin
  lastUpdated: string
  transactions: EnrichedTransaction[]
  draftMap: Record<string, DraftItemEdit>
  pendingChanges: PendingQuantityChange[]
  isSavingBatch: boolean
  onStepDraft: (item: EnrichedItem, delta: number) => void
  onOpenCustomModal: (item: EnrichedItem) => void
  onRevertItem: (itemId: string) => void
  onDiscardAll: () => void
  onRequestConfirmSave: () => void
}

/**
 * BinDetailView: Giao diện chi tiết 1 thùng theo dạng Bill trắng đen siêu gọn (/b/[binCode])
 * - Cho phép chỉnh sửa HÀNG LOẠT nhiều sản phẩm ngay trên bản nháp (bấm − / + hoặc chạm vào SL)
 * - Chưa gửi API ngay: hiện thanh cố định dưới đáy [Hủy] / [Lưu (N món)] -> mở Hộp thoại xác nhận lần 2
 */
export const BinDetailView: React.FC<BinDetailViewProps> = ({
  bin,
  lastUpdated,
  transactions,
  draftMap,
  pendingChanges,
  isSavingBatch,
  onStepDraft,
  onOpenCustomModal,
  onRevertItem,
  onDiscardAll,
  onRequestConfirmSave
}) => {
  const [showHistory, setShowHistory] = useState(false)
  const statusMeta = getStatusMeta(bin.status_5s)
  const hasUnsavedChanges = pendingChanges.length > 0

  // Tính tổng số lượng dự kiến trong thùng theo bản nháp để đối chiếu trực quan ngay phần đầu Bill
  const draftTotalQty = bin.items.reduce((sum, item) => {
    const draft = draftMap[item.id]
    const qty = draft ? draft.quantity : Number(item.quantity) || 0
    return sum + qty
  }, 0)

  return (
    <div className={`space-y-2.5 ${hasUnsavedChanges ? 'pb-20' : ''}`}>
      {/* Khung Bill chính: viền mảnh sắc nét giống tờ phiếu kiểm kho */}
      <article className="rounded-lg border border-zinc-300 bg-white overflow-hidden">
        {/* Phần đầu Bill: Mã thùng + Trạng thái + Vị trí + Tổng tồn */}
        <header className="px-3.5 py-3 border-b border-dashed border-zinc-300 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-2 py-0.5 rounded bg-zinc-900 text-white font-mono text-xs font-bold tracking-tight shrink-0">
                {bin.bin_code}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide shrink-0 ${statusMeta.pillClass}`}
              >
                {statusMeta.label}
              </span>
              {hasUnsavedChanges && (
                <span className="px-1.5 py-0.5 rounded border border-zinc-900 bg-zinc-100 text-[10px] font-bold text-zinc-900 shrink-0">
                  {pendingChanges.length} món chưa lưu
                </span>
              )}
            </div>

            <span className="text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">
              {new Date(lastUpdated).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-zinc-900 leading-snug">{bin.name}</h2>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                {getRoomLabel(bin.room_code)} • {bin.zone_name} • Tầng {bin.tier_number}
              </p>
            </div>

            <div className="shrink-0 text-right font-mono tabular-nums">
              <div className="text-lg font-bold text-zinc-900 leading-none">
                {draftTotalQty !== bin.total_quantity ? (
                  <span>
                    <span className="text-xs font-normal text-zinc-400 mr-1">
                      {bin.total_quantity}→
                    </span>
                    {draftTotalQty}
                  </span>
                ) : (
                  bin.total_quantity
                )}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{bin.items.length} món</div>
            </div>
          </div>
        </header>

        {/* Thanh tiêu đề cột của Bill */}
        <div className="px-3.5 py-1.5 bg-zinc-100/80 border-b border-dashed border-zinc-300 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <span>STT / Thiết bị ({bin.items.length})</span>
          <span>Chỉnh nháp (− / SL / +)</span>
        </div>

        {/* Danh sách sản phẩm: 1 hàng ngang duy nhất cho mỗi món, đánh dấu nổi bật món đã chỉnh nháp */}
        {bin.items.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-1.5">
            <Package className="w-6 h-6 text-zinc-400 mx-auto" weight="duotone" />
            <div className="text-xs font-semibold text-zinc-700">Thùng này hiện đang trống</div>
          </div>
        ) : (
          <div className="divide-y divide-dashed divide-zinc-200">
            {bin.items.map((item, idx) => {
              const originalQty = Number(item.quantity) || 0
              const draft = draftMap[item.id]
              const displayQty = draft ? draft.quantity : originalQty
              const delta = displayQty - originalQty
              const isModified = delta !== 0
              const isZero = displayQty <= 0
              const hasCustomNote = !isDefaultSeedNote(item.note)

              return (
                <div
                  key={item.id}
                  className={`px-3.5 py-2 flex items-center justify-between gap-2.5 transition-colors ${
                    isModified ? 'bg-zinc-100/90 border-l-[3px] border-l-zinc-900 pl-3' : ''
                  }`}
                >
                  {/* Bên trái: STT + Tên món + Dòng đối chiếu Gốc -> Mới nếu đã sửa */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[13px] font-semibold text-zinc-900 leading-tight break-words">
                        {item.name}
                      </span>
                    </div>

                    {isModified && (
                      <div className="pl-5 mt-1 flex items-center flex-wrap gap-1.5 text-[10px] font-mono tabular-nums">
                        <span className="px-1.5 py-[1px] rounded bg-zinc-900 text-white font-bold">
                          {originalQty} → {displayQty} ({delta > 0 ? `+${delta}` : delta})
                        </span>
                        <button
                          type="button"
                          disabled={isSavingBatch}
                          onClick={() => onRevertItem(item.id)}
                          className="inline-flex items-center gap-0.5 text-zinc-600 hover:text-zinc-900 underline underline-offset-2 font-sans font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <ArrowCounterClockwise className="w-2.5 h-2.5" weight="bold" />
                          <span>Hoàn tác</span>
                        </button>
                      </div>
                    )}

                    {hasCustomNote && (
                      <p className="text-[11px] text-zinc-500 pl-5 truncate mt-0.5">{item.note}</p>
                    )}
                  </div>

                  {/* Bên phải: Cụm nút 1 hàng [ − ]  SL  [ + ] chỉnh nháp tức thì */}
                  <div
                    className={`shrink-0 flex items-center rounded-md border p-0.5 gap-0.5 ${
                      isModified
                        ? 'border-zinc-900 bg-white'
                        : 'border-zinc-300 bg-zinc-50'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isZero || isSavingBatch}
                      onClick={() => onStepDraft(item, -1)}
                      aria-label={`Giảm 1 ${item.name} trong nháp`}
                      className="w-8 h-8 rounded border border-zinc-200 bg-white hover:bg-zinc-100 disabled:opacity-30 text-zinc-900 flex items-center justify-center active:scale-[0.94] transition-all cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" weight="bold" />
                    </button>

                    <button
                      type="button"
                      disabled={isSavingBatch}
                      onClick={() => onOpenCustomModal(item)}
                      title="Chạm vào số để nhập số lượng khác hoặc kiểm kê vào nháp"
                      className="min-w-[54px] h-8 px-1.5 rounded hover:bg-zinc-200/70 disabled:opacity-40 flex flex-col items-center justify-center active:scale-[0.97] transition-all cursor-pointer"
                    >
                      <span
                        className={`font-mono text-sm font-bold tabular-nums leading-none ${
                          isZero ? 'text-zinc-400 line-through' : 'text-zinc-900'
                        }`}
                      >
                        {displayQty}
                      </span>
                      <span className="text-[9px] font-medium text-zinc-500 leading-none mt-0.5 truncate max-w-[52px]">
                        {item.unit || 'Cái'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingBatch}
                      onClick={() => onStepDraft(item, 1)}
                      aria-label={`Tăng 1 ${item.name} trong nháp`}
                      className="w-8 h-8 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white flex items-center justify-center active:scale-[0.94] transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" weight="bold" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Chân Bill: Lịch sử xuất nhập thu gọn mặc định */}
        {transactions.length > 0 && (
          <footer className="border-t border-dashed border-zinc-300 bg-zinc-50/70">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-zinc-100/80 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                <ClockCounterClockwise className="w-3.5 h-3.5 text-zinc-500" weight="bold" />
                <span>Lịch sử gần đây ({transactions.length})</span>
              </span>
              {showHistory ? (
                <CaretUp className="w-3.5 h-3.5 text-zinc-500" weight="bold" />
              ) : (
                <CaretDown className="w-3.5 h-3.5 text-zinc-500" weight="bold" />
              )}
            </button>

            {showHistory && (
              <div className="border-t border-dashed border-zinc-200 divide-y divide-dashed divide-zinc-200 bg-white">
                {transactions.map((tx) => {
                  const isPositive = tx.quantity_change > 0
                  return (
                    <div
                      key={tx.id}
                      className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-800 truncate">{tx.item_name}</div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {tx.target_department ? `${tx.target_department} • ` : ''}
                          {new Date(tx.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-mono tabular-nums">
                        <div className="font-bold text-zinc-900">
                          {isPositive ? `+${tx.quantity_change}` : tx.quantity_change}
                        </div>
                        <div className="text-[10px] text-zinc-400">Còn {tx.quantity_after}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </footer>
        )}
      </article>

      {/* Thanh hành động cố định dưới đáy: chỉ xuất hiện khi có ít nhất 1 sản phẩm đang chỉnh nháp */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-t border-zinc-300 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
          <div className="w-full max-w-xl mx-auto px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="text-xs font-bold text-zinc-900 leading-tight">
                Đã chỉnh {pendingChanges.length} món
              </div>
              <div className="text-[10px] text-zinc-500 truncate">
                Bấm Lưu để kiểm tra &amp; xác nhận
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isSavingBatch}
                onClick={onDiscardAll}
                className="h-9 px-3 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-700 disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingBatch}
                onClick={onRequestConfirmSave}
                className="h-9 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <FloppyDisk className="w-3.5 h-3.5" weight="bold" />
                <span>Lưu ({pendingChanges.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
