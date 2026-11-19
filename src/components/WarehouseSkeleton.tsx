import React from 'react'

/**
 * WarehouseSkeleton: Khung tải tạm thời dạng Shimmer khớp đúng bố cục Bill trắng đen gọn nhẹ
 */
export function WarehouseSkeleton(): React.JSX.Element {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f9fafb]">
      {/* Thanh đầu trang giả lập */}
      <div className="h-12 border-b border-zinc-300 bg-white px-3.5">
        <div className="w-full max-w-xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md skeleton-shimmer" />
            <div className="space-y-1">
              <div className="h-2 w-24 rounded skeleton-shimmer" />
              <div className="h-3 w-28 rounded skeleton-shimmer" />
            </div>
          </div>
          <div className="h-7 w-20 rounded-md skeleton-shimmer" />
        </div>
      </div>

      {/* Khối Bill giả lập */}
      <div className="w-full max-w-xl mx-auto px-3.5 pt-3">
        <div className="rounded-lg border border-zinc-300 bg-white overflow-hidden">
          <div className="p-3.5 border-b border-dashed border-zinc-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-5 w-24 rounded skeleton-shimmer" />
              <div className="h-3.5 w-14 rounded skeleton-shimmer" />
            </div>
            <div className="h-5 w-2/3 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
          </div>

          <div className="divide-y divide-dashed divide-zinc-200">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="h-4 w-1/2 rounded skeleton-shimmer" />
                <div className="h-8 w-36 rounded-md skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
