'use client'

import React, { useState } from 'react'
import { X } from '@phosphor-icons/react'
import type { EnrichedItem, WarehouseTxType } from '@/lib/types'

interface CustomAdjustModalProps {
  item: EnrichedItem
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (
    item: EnrichedItem,
    txType: WarehouseTxType,
    amount: number,
    department: string
  ) => Promise<boolean>
}

const QUICK_PRESETS = [1, 2, 5, 10]

/**
 * CustomAdjustModal: Hộp thoại nhập số lượng Xuất / Nhập / Kiểm kê tùy chọn
 * - Dạng Bottom-Sheet trên điện thoại để dễ bấm 1 tay
 * - Kèm sẵn nút chọn nhanh 1 / 2 / 5 / 10 giảm thao tác gõ bàn phím
 */
export const CustomAdjustModal: React.FC<CustomAdjustModalProps> = ({
  item,
  isSubmitting,
  onClose,
  onSubmit
}) => {
  const [txType, setTxType] = useState<WarehouseTxType>('export')
  const [amount, setAmount] = useState<string>('1')
  const [department, setDepartment] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleConfirm = async (e: React.FormEvent): Promise<void> => {
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
    if (txType === 'adjust' && num < 0) {
      setFormError('Số lượng kiểm kê không thể nhỏ hơn 0.')
      return
    }
    const ok = await onSubmit(item, txType, num, department)
    if (ok) onClose()
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-zinc-900/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleConfirm}
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight text-zinc-900 truncate">
              {item.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              Tồn hiện tại: <strong className="text-emerald-700">{item.quantity}</strong>{' '}
              {item.unit || 'Cái'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-zinc-900 cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>

        {/* 3 chế độ nghiệp vụ rõ ràng */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTxType('export')
              setAmount('1')
              setFormError(null)
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              txType === 'export'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-zinc-900'
            }`}
          >
            Xuất đi
          </button>
          <button
            type="button"
            onClick={() => {
              setTxType('import')
              setAmount('1')
              setFormError(null)
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              txType === 'import'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-zinc-900'
            }`}
          >
            Nhập thêm
          </button>
          <button
            type="button"
            onClick={() => {
              setTxType('adjust')
              setAmount(String(item.quantity))
              setFormError(null)
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              txType === 'adjust'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-zinc-900'
            }`}
          >
            Kiểm kê
          </button>
        </div>

        {/* Input Số lượng + các nút chọn nhanh */}
        <div className="space-y-2">
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
                    className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold cursor-pointer ${
                      amount === String(n)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
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
            className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-lg font-mono font-bold tabular-nums text-zinc-900 outline-none focus:border-emerald-600"
          />
          {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}
        </div>

        {/* Input Khoa/Phòng nhận */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-700">
            Khoa / Phòng nhận (tùy chọn):
          </label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="VD: Khoa Nội 1, Quầy Thu Ngân..."
            className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-slate-400 outline-none focus:border-emerald-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-zinc-700 active:scale-[0.98] transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu...' : 'Xác nhận lưu'}
          </button>
        </div>
      </form>
    </div>
  )
}
