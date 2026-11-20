'use client'

import React from 'react'
import {
  ArrowCounterClockwise,
  CheckCircle,
  FloppyDisk,
  SpinnerGap,
  WarningCircle,
  X
} from '@phosphor-icons/react'
import type { PendingQuantityChange, WarehouseTxType } from '@/lib/types'

interface BatchConfirmModalProps {
  binCode: string
  binName: string
  changes: PendingQuantityChange[]
  department: string
  isSubmitting: boolean
  submitError: string | null
  onChangeDepartment: (value: string) => void
  onRevertSingleItem: (itemId: string) => void
  onClose: () => void
  onConfirmSave: () => void
}

/**
 * Nhãn phân loại ngắn gọn cho từng dòng thay đổi trong bảng đối chiếu xác nhận
 */
function getTxBadge(txType: WarehouseTxType): { label: string; className: string } {
  if (txType === 'export') {
    return {
      label: 'XUẤT',
      className: 'border border-zinc-900 bg-white text-zinc-900'
    }
  }
  if (txType === 'import') {
    return {
      label: 'NHẬP',
      className: 'border border-zinc-900 bg-zinc-900 text-white'
    }
  }
  return {
    label: 'KIỂM KÊ',
    className: 'border border-dashed border-zinc-700 bg-zinc-100 text-zinc-900'
  }
}

/**
 * BatchConfirmModal: Hộp thoại Xác Nhận Lần 2 trước khi gửi yêu cầu lưu hàng loạt lên Backend
 * - Hiển thị bảng đối chiếu Cũ -> Mới + Chênh lệch của toàn bộ sản phẩm đã chỉnh sửa
 * - Cho phép bỏ bớt từng món, nhập Khoa/Phòng nhận tùy chọn, rồi mới bấm Xác nhận gửi API
 */
export const BatchConfirmModal: React.FC<BatchConfirmModalProps> = ({
  binCode,
  binName,
  changes,
  department,
  isSubmitting,
  submitError,
  onChangeDepartment,
  onRevertSingleItem,
  onClose,
  onConfirmSave
}) => {
  // Tính tổng số lượng xuất đi và nhập thêm trên toàn lô để người dùng rà nhanh bằng mắt
  const totalExport = changes.reduce((sum, ch) => (ch.delta < 0 ? sum + Math.abs(ch.delta) : sum), 0)
  const totalImport = changes.reduce((sum, ch) => (ch.delta > 0 ? sum + ch.delta : sum), 0)

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (isSubmitting || changes.length === 0) return
    onConfirmSave()
  }

  return (
    <div
      onClick={() => {
        if (!isSubmitting) onClose()
      }}
      className="fixed inset-0 z-50 bg-zinc-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-xl border border-zinc-300 bg-white shadow-2xl overflow-hidden"
      >
        {/* Tiêu đề Hộp thoại Xác nhận */}
        <header className="px-4 py-3 border-b border-dashed border-zinc-300 flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono text-[10px] font-bold">
                {binCode}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Bước xác nhận lưu
              </span>
            </div>
            <h3 className="text-sm font-bold text-zinc-900 mt-1 leading-snug">
              Xác nhận cập nhật {changes.length} sản phẩm
            </h3>
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{binName}</p>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 cursor-pointer shrink-0"
            title="Quay lại chỉnh sửa"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </header>

        {/* Bảng đối chiếu danh sách Cũ -> Mới có thể cuộn mượt nếu sửa nhiều món */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div className="rounded-lg border border-zinc-300 overflow-hidden">
            <div className="px-3 py-1.5 bg-zinc-100 border-b border-dashed border-zinc-300 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <span>Sản phẩm ({changes.length})</span>
              <span>Cũ → Mới</span>
            </div>

            <div className="divide-y divide-dashed divide-zinc-200 bg-white">
              {changes.map((ch, idx) => {
                const badge = getTxBadge(ch.txType)
                const deltaText = ch.delta > 0 ? `+${ch.delta}` : `${ch.delta}`
                return (
                  <div
                    key={ch.item.id}
                    className="px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] text-zinc-400 tabular-nums shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-semibold text-zinc-900 truncate">
                          {ch.item.name}
                        </span>
                      </div>
                      <div className="mt-0.5 pl-4 flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-[1px] rounded text-[9px] font-bold tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {ch.item.unit || 'Cái'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-xs font-bold text-zinc-900">
                          <span className="text-zinc-400 font-normal">{ch.originalQty}</span>
                          <span className="mx-1 text-zinc-400">→</span>
                          <span>{ch.draftQty}</span>
                        </div>
                        <div className="text-[10px] font-bold text-zinc-700">({deltaText})</div>
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onRevertSingleItem(ch.item.id)}
                        title={`Bỏ thay đổi của ${ch.item.name}`}
                        aria-label={`Bỏ thay đổi của ${ch.item.name}`}
                        className="w-7 h-7 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-200/70 text-zinc-600 hover:text-zinc-900 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowCounterClockwise className="w-3.5 h-3.5" weight="bold" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Thanh tổng hợp Xuất / Nhập ở chân bảng */}
            <div className="px-3 py-2 bg-zinc-50 border-t border-dashed border-zinc-300 flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-700">
              <span>Tổng: {changes.length} món</span>
              <div className="flex items-center gap-2.5 font-bold text-zinc-900">
                {totalExport > 0 && <span>Xuất −{totalExport}</span>}
                {totalImport > 0 && <span>Nhập +{totalImport}</span>}
              </div>
            </div>
          </div>

          {/* Ô Khoa / Phòng nhận hoặc ghi chú dùng chung cho cả lô */}
          <div className="space-y-1">
            <label
              htmlFor="batch-department-input"
              className="block text-xs font-semibold text-zinc-700"
            >
              Khoa / Phòng nhận hoặc Ghi chú (tùy chọn):
            </label>
            <input
              id="batch-department-input"
              type="text"
              disabled={isSubmitting}
              value={department}
              onChange={(e) => onChangeDepartment(e.target.value)}
              placeholder="VD: Khoa Nội 1, Quầy Thu Ngân, Kiểm kê..."
              className="w-full h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 disabled:opacity-50"
            />
          </div>

          {/* Thông báo lỗi nếu gửi API thất bại (giữ nguyên danh sách để bấm thử lại an toàn) */}
          {submitError && (
            <div className="rounded-lg border border-zinc-900 bg-zinc-100 px-3 py-2 flex items-start gap-2 text-xs text-zinc-900">
              <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" weight="fill" />
              <span className="leading-snug">{submitError}</span>
            </div>
          )}

          {/* Ghi chú bảo đảm an toàn trước khi bấm nút xác nhận */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <CheckCircle className="w-3.5 h-3.5 text-zinc-700 shrink-0" weight="bold" />
            <span>
              Toàn bộ {changes.length} thay đổi sẽ được gửi gộp trong 1 lượt lưu lên hệ thống Kho IT.
            </span>
          </div>
        </div>

        {/* Chân Hộp thoại: Quay lại sửa / Xác nhận & Gửi lưu */}
        <footer className="px-4 py-3 border-t border-dashed border-zinc-300 bg-zinc-50 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-10 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-800 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            Quay lại sửa
          </button>
          <button
            type="submit"
            disabled={isSubmitting || changes.length === 0}
            className="h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <SpinnerGap className="w-4 h-4 animate-spin" weight="bold" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <FloppyDisk className="w-4 h-4" weight="bold" />
                <span>Xác nhận & Lưu</span>
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  )
}

