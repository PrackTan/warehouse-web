'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowsClockwise, Package } from '@phosphor-icons/react'

interface WarehouseHeaderProps {
  showBackHome: boolean
  isRefreshing: boolean
  onRefresh: () => void
}

/**
 * WarehouseHeader: Thanh đầu trang ghim cố định với nút quay lại Kho tổng và nút Đồng bộ nhanh
 */
export const WarehouseHeader: React.FC<WarehouseHeaderProps> = ({
  showBackHome,
  isRefreshing,
  onRefresh
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="w-full max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
          <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" weight="duotone" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 leading-none">
              BVĐK Tân Hưng • Tổ CNTT
            </div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-900 truncate mt-0.5">
              Kho Thiết Bị &amp; Vật Tư IT
            </h1>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {showBackHome && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-zinc-700 active:scale-[0.98] transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
              <span>Kho tổng</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <ArrowsClockwise
              className={`w-3.5 h-3.5 text-emerald-700 ${isRefreshing ? 'animate-spin' : ''}`}
              weight="bold"
            />
            <span>{isRefreshing ? 'Đang tải' : 'Làm mới'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
