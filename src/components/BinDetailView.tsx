'use client'

import React, { useState } from 'react'
import {
  CaretDown,
  CaretUp,
  ClockCounterClockwise,
  Minus,
  Package,
  Plus
} from '@phosphor-icons/react'
import type { EnrichedBin, EnrichedItem, EnrichedTransaction, WarehouseTxType } from '@/lib/types'
import { getRoomLabel, getStatusMeta, isDefaultSeedNote } from './warehouseUiUtils'

interface BinDetailViewProps {
  bin: EnrichedBin
  lastUpdated: string
  transactions: EnrichedTransaction[]
  busyItemId: string | null
  onQuickAdjust: (item: EnrichedItem, txType: WarehouseTxType, amount: number) => void
  onOpenCustomModal: (item: EnrichedItem) => void
}

/**
 * BinDetailView: Giao diện chi tiết 1 thùng theo dạng Bill trắng đen siêu gọn (/b/[binCode])
 * - Gom trọn thông tin đầu thùng + bảng thiết bị trong 1 khung phiếu trắng, phân tách bằng đường nét đứt
 * - Mỗi sản phẩm chỉ chiếm ĐÚNG 1 hàng ngang: Tên bên trái — Cụm stepper [ − ] SL [ + ] bên phải
 * - Chạm thẳng vào ô số lượng (VD: "8 Cái") để mở hộp nhập số lượng khác / kiểm kê
 */
export const BinDetailView: React.FC<BinDetailViewProps> = ({
  bin,
  lastUpdated,
  transactions,
  busyItemId,
  onQuickAdjust,
  onOpenCustomModal
}) => {
  const [showHistory, setShowHistory] = useState(false)
  const statusMeta = getStatusMeta(bin.status_5s)

  return (
    <div className="space-y-2.5">
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
                {bin.total_quantity}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{bin.items.length} món</div>
            </div>
          </div>
        </header>

        {/* Thanh tiêu đề cột của Bill */}
        <div className="px-3.5 py-1.5 bg-zinc-100/80 border-b border-dashed border-zinc-300 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <span>STT / Thiết bị ({bin.items.length})</span>
          <span>−1 / Chạm SL / +1</span>
        </div>

        {/* Danh sách sản phẩm: 1 hàng ngang duy nhất cho mỗi món */}
        {bin.items.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-1.5">
            <Package className="w-6 h-6 text-zinc-400 mx-auto" weight="duotone" />
            <div className="text-xs font-semibold text-zinc-700">Thùng này hiện đang trống</div>
          </div>
        ) : (
          <div className="divide-y divide-dashed divide-zinc-200">
            {bin.items.map((item, idx) => {
              const qty = Number(item.quantity) || 0
              const isZero = qty <= 0
              const isBusy = busyItemId === item.id
              const hasCustomNote = !isDefaultSeedNote(item.note)

              return (
                <div
                  key={item.id}
                  className="px-3.5 py-2 flex items-center justify-between gap-2.5"
                >
                  {/* Bên trái: STT + Tên món (chỉ hiện thêm ghi chú tùy chỉnh nếu có) */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[13px] font-semibold text-zinc-900 leading-tight break-words">
                        {item.name}
                      </span>
                    </div>
                    {hasCustomNote && (
                      <p className="text-[11px] text-zinc-500 pl-5 truncate mt-0.5">{item.note}</p>
                    )}
                  </div>

                  {/* Bên phải: Cụm nút 1 hàng [ − ]  SL  [ + ] */}
                  <div className="shrink-0 flex items-center rounded-md border border-zinc-300 bg-zinc-50 p-0.5 gap-0.5">
                    <button
                      type="button"
                      disabled={isZero || isBusy}
                      onClick={() => onQuickAdjust(item, 'export', 1)}
                      aria-label={`Lấy ra 1 ${item.name}`}
                      className="w-8 h-8 rounded border border-zinc-200 bg-white hover:bg-zinc-100 disabled:opacity-30 text-zinc-900 flex items-center justify-center active:scale-[0.94] transition-all cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" weight="bold" />
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onOpenCustomModal(item)}
                      title="Chạm vào số để nhập số lượng khác hoặc kiểm kê"
                      className="min-w-[54px] h-8 px-1.5 rounded hover:bg-zinc-200/70 disabled:opacity-40 flex flex-col items-center justify-center active:scale-[0.97] transition-all cursor-pointer"
                    >
                      <span
                        className={`font-mono text-sm font-bold tabular-nums leading-none ${
                          isZero ? 'text-zinc-400 line-through' : 'text-zinc-900'
                        }`}
                      >
                        {isBusy ? '...' : qty}
                      </span>
                      <span className="text-[9px] font-medium text-zinc-500 leading-none mt-0.5 truncate max-w-[52px]">
                        {item.unit || 'Cái'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onQuickAdjust(item, 'import', 1)}
                      aria-label={`Nhập thêm 1 ${item.name}`}
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
    </div>
  )
}
