'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MagnifyingGlass, Package, X } from '@phosphor-icons/react'
import type { EnrichedBin, WarehouseRoomCode } from '@/lib/types'
import { getRoomLabel, getStatusMeta } from './warehouseUiUtils'

interface BinCatalogViewProps {
  bins: EnrichedBin[]
}

type RoomFilter = 'all' | WarehouseRoomCode

/**
 * BinCatalogView: Danh sách tra cứu toàn bộ thùng trên Trang chủ (/) theo phong cách Bill trắng đen gọn nhẹ
 * - Dạng danh sách phẳng 1 cột có đường kẻ nét đứt để cuộn cực nhanh, không rối mắt
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
    <div className="space-y-2.5">
      {/* Thanh tìm kiếm & lọc phòng */}
      <div className="space-y-2">
        <div className="relative">
          <MagnifyingGlass
            className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            weight="bold"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm vật tư hoặc mã thùng (VD: VGA, THUNG-06)..."
            className="w-full h-10 rounded-lg border border-zinc-300 bg-white pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-800 cursor-pointer"
              title="Xóa từ khóa"
            >
              <X className="w-3.5 h-3.5" weight="bold" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/70 border border-zinc-300 text-[11px] font-semibold">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'storage_room', label: 'Phòng Kho' },
                { id: 'working_room', label: 'Phòng Làm Việc' }
              ] as const
            ).map((tab) => {
              const active = roomFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoomFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
            {filteredBins.length} thùng • {totalItemsQty} ĐV
          </span>
        </div>
      </div>

      {/* Bảng Bill danh sách thùng */}
      {filteredBins.length === 0 ? (
        <div className="rounded-lg border border-zinc-300 bg-white p-8 text-center space-y-2">
          <Package className="w-6 h-6 text-zinc-400 mx-auto" weight="duotone" />
          <div className="text-xs font-semibold text-zinc-800">Không tìm thấy thùng phù hợp</div>
          {(searchQuery || roomFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setRoomFilter('all')
              }}
              className="px-3 py-1 rounded-md border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-xs font-semibold text-zinc-800 cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-300 bg-white divide-y divide-dashed divide-zinc-200 overflow-hidden">
          {filteredBins.map((bin) => {
            const statusMeta = getStatusMeta(bin.status_5s)
            return (
              <Link
                key={bin.id}
                href={`/b/${encodeURIComponent(bin.bin_code)}`}
                className="group px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono text-[11px] font-bold shrink-0">
                      {bin.bin_code}
                    </span>
                    <span className="text-[13px] font-bold text-zinc-900 truncate">{bin.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 truncate">
                    <span className={`px-1.5 py-0 rounded text-[9px] font-bold ${statusMeta.pillClass}`}>
                      {statusMeta.label}
                    </span>
                    <span className="truncate">
                      {getRoomLabel(bin.room_code)} • Tầng {bin.tier_number}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 font-mono tabular-nums">
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-900 leading-none">
                      {bin.total_quantity}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{bin.items.length} món</div>
                  </div>
                  <ArrowRight
                    className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 transition-colors"
                    weight="bold"
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
