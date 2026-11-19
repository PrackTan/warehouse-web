'use client'

import React, { useState } from 'react'
import {
  CaretDown,
  CaretUp,
  ClockCounterClockwise,
  MapPin,
  Minus,
  Package,
  Plus,
  SlidersHorizontal
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
 * BinDetailView: Giao diện chi tiết 1 thùng khi quét mã QR (/b/[binCode])
 * - Bố cục siêu gọn tập trung thao tác Xuất / Nhập bằng 1 tay
 * - Danh sách thiết bị dạng phẳng divide-y (tránh đóng khung lồng nhau) với số lượng tồn lớn rõ ràng
 * - Lịch sử gần đây thu gọn mặc định để không choán màn hình điện thoại
 */
export const BinDetailView: React.FC<BinDetailViewProps> = ({
  bin,
  lastUpdated,
  transactions,
  busyItemId,
  onQuickAdjust,
  onOpenCustomModal
}) => {
  // Thu gọn lịch sử mặc định theo thiết kế ưu tiên hiển thị ngay danh sách vật tư
  const [showHistory, setShowHistory] = useState(false)
  const statusMeta = getStatusMeta(bin.status_5s)

  return (
    <div className="space-y-3.5">
      {/* Khối 1: Thông tin định danh đầu Thùng siêu gọn */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white font-mono text-xs font-bold tracking-tight shrink-0">
              {bin.bin_code}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusMeta.pillClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
              <span>{statusMeta.label}</span>
            </span>
          </div>

          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            {new Date(lastUpdated).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 leading-snug">
              {bin.name}
            </h2>
            <p className="inline-flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" weight="duotone" />
              <span className="truncate">
                {getRoomLabel(bin.room_code)} • {bin.zone_name} • Tầng {bin.tier_number}
              </span>
            </p>
          </div>

          <div className="shrink-0 text-right pl-2 border-l border-slate-200/80">
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 leading-none">
              {bin.total_quantity}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              tổng ({bin.items.length} món)
            </div>
          </div>
        </div>
      </section>

      {/* Khối 2: Danh sách thiết bị bên trong dạng phẳng (divide-y) */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_-14px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Thiết bị / Vật tư ({bin.items.length})
          </span>
          <span className="text-[11px] font-medium text-slate-400">Chạm 1 tay Xuất / Nhập</span>
        </div>

        {bin.items.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Package className="w-5 h-5" weight="duotone" />
            </div>
            <div className="text-sm font-semibold text-zinc-700">Thùng này hiện đang trống</div>
            <p className="text-xs text-slate-500">
              Thêm sản phẩm vào thùng trên WikiHIS Desktop rồi bấm Đồng bộ Web.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/75">
            {bin.items.map((item, idx) => {
              const qty = Number(item.quantity) || 0
              const isZero = qty <= 0
              const isBusy = busyItemId === item.id
              const hasCustomNote = !isDefaultSeedNote(item.note)

              return (
                <div key={item.id} className="p-4 space-y-3">
                  {/* Hàng trên: Tên thiết bị bên trái + Số lượng tồn lớn bên phải */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-[15px] font-semibold text-zinc-900 leading-snug">
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 pl-6">
                        {item.category || 'Vật tư IT'}
                        {hasCustomNote ? ` • ${item.note}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <div
                        className={`font-mono text-2xl font-bold tabular-nums leading-none ${
                          isZero ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {qty}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 mt-1">
                        {item.unit || 'Cái'}
                      </div>
                    </div>
                  </div>

                  {/* Hàng dưới: 3 nút thao tác lớn tối ưu cầm điện thoại 1 tay */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <button
                      type="button"
                      disabled={isZero || isBusy}
                      onClick={() => onQuickAdjust(item, 'export', 1)}
                      className="h-11 rounded-xl border border-rose-200 bg-rose-50/75 hover:bg-rose-100/80 disabled:opacity-40 text-rose-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" weight="bold" />
                      <span>{isBusy ? 'Đang lưu...' : '1 Lấy ra'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onQuickAdjust(item, 'import', 1)}
                      className="h-11 rounded-xl border border-emerald-200 bg-emerald-50/75 hover:bg-emerald-100/80 disabled:opacity-40 text-emerald-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" weight="bold" />
                      <span>{isBusy ? 'Đang lưu...' : '1 Nhập vào'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onOpenCustomModal(item)}
                      className="h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-zinc-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                      title="Nhập số lượng tùy chỉnh hoặc kiểm kê"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" weight="bold" />
                      <span>SL khác</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Khối 3: Lịch sử xuất nhập gần đây (Mặc định thu gọn, chạm để mở) */}
      {transactions.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_6px_18px_-12px_rgba(15,23,42,0.05)]">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
              <ClockCounterClockwise className="w-4 h-4 text-slate-500" weight="duotone" />
              <span>Lịch sử gần đây ({transactions.length})</span>
            </span>
            {showHistory ? (
              <CaretUp className="w-4 h-4 text-slate-400" weight="bold" />
            ) : (
              <CaretDown className="w-4 h-4 text-slate-400" weight="bold" />
            )}
          </button>

          {showHistory && (
            <div className="border-t border-slate-200/80 divide-y divide-slate-200/75">
              {transactions.map((tx) => {
                const isPositive = tx.quantity_change > 0
                return (
                  <div key={tx.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-800 truncate">
                        {tx.item_name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {tx.target_department ? `${tx.target_department} • ` : ''}
                        {new Date(tx.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-mono tabular-nums">
                      <div
                        className={`text-xs font-bold ${
                          isPositive ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {isPositive ? `+${tx.quantity_change}` : tx.quantity_change}
                      </div>
                      <div className="text-[10px] text-slate-400">Còn {tx.quantity_after}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
