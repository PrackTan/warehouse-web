'use client'

import React, { useState } from 'react'
import { X } from '@phosphor-icons/react'
import type { EnrichedItem, WarehouseTxType } from '@/lib/types'

interface CustomAdjustModalProps {
  item: EnrichedItem
  currentDraftQty: number
  onClose: () => void
  onApplyDraft: (item: EnrichedItem, nextQty: number, mode: 'delta' | 'adjust') => void
}

const QUICK_PRESETS = [1, 2, 5, 10]

/**
 * CustomAdjustModal: Hộp thoại nhập số lượng nhanh vào BẢN NHÁP (chưa gửi API ngay)
 * - Cho phép chọn Xuất đi / Nhập thêm / Kiểm kê rồi áp dụng vào danh sách nháp của thùng
 * - Người dùng có thể chỉnh tiếp nhiều món khác rồi bấm Lưu -> Xác nhận lần 2 để gửi 1 lần
 */
export const CustomAdjustModal: React.FC<CustomAdjustModalProps> = ({
  item,
  currentDraftQty,
  onClose,
  onApplyDraft
}) => {
  const originalQty = Number(item.quantity) || 0
  const [txType, setTxType] = useState<WarehouseTxType>('export')
  const [amount, setAmount] = useState<string>('1')
  const [formError, setFormError] = useState<string | null>(null)

  // Tính trước số lượng dự kiến sau khi áp dụng để người dùng kiểm tra ngay
  const parsedAmount = parseInt(amount, 10)
  const previewQty = Number.isNaN(parsedAmount)
    ? currentDraftQty
    : txType === 'export'
      ? Math.max(0, currentDraftQty - Math.max(0, parsedAmount))
      : txType === 'import'
        ? currentDraftQty + Math.max(0, parsedAmount)
        : Math.max(0, parsedAmount)

  const handleConfirm = (e: React.FormEvent): void => {
    e.preventDefault()
    setFormError(null)
    const num = parseInt(amount, 10)
    if (Number.isNaN(num)) {
      setFormError('Vui lòng nhập số lượng hợp lệ.')
      return
    }
    if ((txType === 'export' || txType === 'import') && num <= 0) {
      setFormError('Số lượng Xuất / Nhập phải lớn hơn 0.')
      return
    }
    if (txType === 'export' && num > currentDraftQty) {
      setFormError(`Không thể xuất quá số lượng hiện có (${currentDraftQty} ${item.unit || 'Cái'}).`)
      return
    }
    if (txType === 'adjust' && num < 0) {
      setFormError('Số lượng kiểm kê không thể nhỏ hơn 0.')
      return
    }

    const nextQty =
      txType === 'export'
        ? currentDraftQty - num
        : txType === 'import'
          ? currentDraftQty + num
          : num

    onApplyDraft(item, nextQty, txType === 'adjust' ? 'adjust' : 'delta')
    onClose()
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-zinc-950/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleConfirm}
        className="w-full max-w-md rounded-t-2xl sm:rounded-xl border border-zinc-300 bg-white p-4 space-y-3.5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-dashed border-zinc-300">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-900 truncate">{item.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono tabular-nums">
              Tồn gốc: <strong className="text-zinc-900">{originalQty}</strong>
              {currentDraftQty !== originalQty && (
                <>
                  {' '}
                  • Đang sửa: <strong className="text-zinc-900">{currentDraftQty}</strong>
                </>
              )}{' '}
              {item.unit || 'Cái'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-zinc-100 border border-zinc-300 text-xs font-bold">
          {(
            [
              { id: 'export', label: 'Xuất đi', defaultAmt: '1' },
              { id: 'import', label: 'Nhập thêm', defaultAmt: '1' },
              { id: 'adjust', label: 'Kiểm kê', defaultAmt: String(currentDraftQty) }
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setTxType(mode.id)
                setAmount(mode.defaultAmt)
                setFormError(null)
              }}
              className={`py-1.5 rounded-md transition-all cursor-pointer ${
                txType === mode.id
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-zinc-700">
              {txType === 'adjust' ? 'Số lượng đếm thực tế:' : 'Số lượng thay đổi:'}
            </label>
            {txType !== 'adjust' && (
              <div className="flex items-center gap-1">
                {QUICK_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setAmount(String(n))
                      setFormError(null)
                    }}
                    className={`px-2 py-0.5 rounded border text-xs font-mono font-bold cursor-pointer ${
                      amount === String(n)
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="number"
            inputMode="numeric"
            min={txType === 'adjust' ? 0 : 1}
            required
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setFormError(null)
            }}
            className="w-full h-10 rounded-lg border border-zinc-400 bg-white px-3 text-base font-mono font-bold tabular-nums text-zinc-900 outline-none focus:border-zinc-900"
          />

          {/* Xem trước kết quả tạm tính */}
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-500 pt-0.5">
            <span>Dự kiến sau khi áp dụng (chưa gửi lưu):</span>
            <strong className="text-zinc-900">
              {currentDraftQty} → {previewQty} {item.unit || 'Cái'}
            </strong>
          </div>

          {formError && <p className="text-xs font-semibold text-zinc-900">{formError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-700 active:scale-[0.98] transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white active:scale-[0.98] transition-all cursor-pointer"
          >
            Áp dụng vào nháp
          </button>
        </div>
      </form>
    </div>
  )
}
