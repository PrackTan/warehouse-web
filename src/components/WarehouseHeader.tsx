'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowsClockwise, Package } from '@phosphor-icons/react'

interface WarehouseHeaderProps {
  showBackHome: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onNavigateHome?: () => void
}

/**
 * WarehouseHeader: Thanh đầu trang tối giản phong cách Bill trắng đen, ghim cố định trên cùng
 */
export const WarehouseHeader: React.FC<WarehouseHeaderProps> = ({
  showBackHome,
  isRefreshing,
  onRefresh,
  onNavigateHome
}) => {
  // Chặn điều hướng trực tiếp khi đang có bản nháp chưa lưu để hỏi xác nhận an toàn
  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (onNavigateHome) {
      e.preventDefault()
      onNavigateHome()
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 border-b border-zinc-300">
      <div className="w-full max-w-xl mx-auto px-3.5 h-12 flex items-center justify-between gap-2">
        <Link href="/" onClick={handleHomeClick} className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-md border border-zinc-900 bg-zinc-900 text-white flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" weight="bold" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 leading-none">
              BVĐK TÂN HƯNG • TỔ CNTT
            </div>
            <h1 className="text-xs font-bold tracking-tight text-zinc-900 truncate mt-0.5">
              Kho Vật Tư IT
            </h1>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          {showBackHome && (
            <Link
              href="/"
              onClick={handleHomeClick}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-[11px] font-semibold text-zinc-800 active:scale-[0.98] transition-all"
            >
              <ArrowLeft className="w-3 h-3" weight="bold" />
              <span>Kho tổng</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-900 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <ArrowsClockwise
              className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
              weight="bold"
            />
            <span>{isRefreshing ? 'Đang tải' : 'Làm mới'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
