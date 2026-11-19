'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MagnifyingGlass, MapPin, Package, X } from '@phosphor-icons/react'
import type { EnrichedBin, WarehouseRoomCode } from '@/lib/types'
import { getRoomLabel, getStatusMeta } from './warehouseUiUtils'

interface BinCatalogViewProps {
  bins: EnrichedBin[]
}

type RoomFilter = 'all' | WarehouseRoomCode

/**
 * BinCatalogView: Trang chủ (/) tra cứu toàn bộ thùng & vật tư Kho IT
 * - Mobile: 1 cột dễ cuộn 1 tay; Tablet/Desktop: Grid 2 cột cân đối
 * - Hỗ trợ tìm kiếm tức thì theo tên vật tư / mã thùng và lọc theo phòng
 */
export const BinCatalogView: React.FC<BinCatalogViewProps> = ({ bins }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [roomFilter, setRoomFilter] = useState<RoomFilter>('all')

  const filteredBins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return bins.filter((b) => {
      if (roomFilter !== 'all' && b.room_code !== roomFilter) return false
      if (!q) return true
      if (b.bin_code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)) return true
      return b.items.some(
        (it) => it.name.toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q)
      )
    })
  }, [bins, roomFilter, searchQuery])

  const totalItemsQty = useMemo(
    () => filteredBins.reduce((sum, b) => sum + (b.total_quantity || 0), 0),
    [filteredBins]
  )

  return (
    <div className="space-y-4">
      {/* Thanh tìm kiếm & Bộ lọc Phòng gọn gàng */}
      <section className="space-y-2.5">
        <div className="relative">
          <MagnifyingGlass
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            weight="bold"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm vật tư hoặc mã thùng (VD: VGA, Adapter, THUNG-06)..."
            className="w-full h-11 rounded-2xl border border-slate-200/90 bg-white pl-10 pr-10 text-sm text-zinc-900 placeholder:text-slate-400 shadow-[0_2px_10px_-6px_rgba(15,23,42,0.08)] focus:border-emerald-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-zinc-700 hover:bg-slate-100 cursor-pointer"
              title="Xóa từ khóa"
            >
              <X className="w-3.5 h-3.5" weight="bold" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Segmented filter theo 2 phòng */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold">
            {(
              [
                { id: 'all', label: 'Tất cả phòng' },
                { id: 'storage_room', label: 'Phòng Kho IT' },
                { id: 'working_room', label: 'Phòng Làm Việc' }
              ] as const
            ).map((tab) => {
              const active = roomFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoomFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-slate-600 hover:text-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="text-xs font-medium text-slate-500 font-mono tabular-nums">
            {filteredBins.length} thùng • {totalItemsQty} đơn vị
          </div>
        </div>
      </section>

      {/* Danh sách Thùng (Empty state khi không tìm thấy kết quả) */}
      {filteredBins.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-5 h-5" weight="duotone" />
          </div>
          <div className="text-sm font-semibold text-zinc-800">Không tìm thấy thùng phù hợp</div>
          <p className="text-xs text-slate-500">
            Thử đổi từ khóa khác hoặc chuyển bộ lọc sang Tất cả phòng.
          </p>
          {(searchQuery || roomFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setRoomFilter('all')
              }}
              className="mt-1 inline-flex items-center px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-zinc-700 cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBins.map((bin) => {
            const statusMeta = getStatusMeta(bin.status_5s)
            return (
              <Link
                key={bin.id}
                href={`/b/${encodeURIComponent(bin.bin_code)}`}
                className="group rounded-2xl border border-slate-200/80 bg-white hover:border-emerald-300 p-4 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.08)] flex flex-col justify-between gap-3 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-white font-mono text-xs font-bold tracking-tight shrink-0">
                      {bin.bin_code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold truncate ${statusMeta.pillClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                      <span>{statusMeta.label}</span>
                    </span>
                  </div>

                  <span className="font-mono text-xs font-bold tabular-nums text-emerald-700 shrink-0">
                    {bin.items.length} món • SL {bin.total_quantity}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-[15px] font-bold text-zinc-900 group-hover:text-emerald-800 transition-colors leading-snug">
                    {bin.name}
                  </h3>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" weight="duotone" />
                      <span className="truncate">
                        {getRoomLabel(bin.room_code)} • {bin.zone_name} • Tầng {bin.tier_number}
                      </span>
                    </span>
                    <ArrowRight
                      className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all shrink-0"
                      weight="bold"
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
