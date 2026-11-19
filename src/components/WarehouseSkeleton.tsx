import React from 'react'

/**
 * WarehouseSkeleton: Khung tải tạm thời dạng Shimmer khớp đúng bố cục sáng (#f9fafb)
 * Tránh hiện vòng quay tròn gây cảm giác giật khi mở liên kết QR qua mạng 4G
 */
export function WarehouseSkeleton(): React.JSX.Element {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f9fafb]">
      {/* Thanh đầu trang giả lập */}
      <div className="h-14 border-b border-slate-200/80 bg-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl skeleton-shimmer" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-28 rounded skeleton-shimmer" />
            <div className="h-3.5 w-36 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-8 w-20 rounded-xl skeleton-shimmer" />
      </div>

      {/* Khối nội dung giả lập */}
      <div className="w-full max-w-3xl mx-auto px-4 pt-4 space-y-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 rounded-lg skeleton-shimmer" />
            <div className="h-4 w-20 rounded skeleton-shimmer" />
          </div>
          <div className="h-6 w-3/4 rounded skeleton-shimmer" />
          <div className="h-4 w-1/2 rounded skeleton-shimmer" />
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white divide-y divide-slate-200/75 overflow-hidden">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded skeleton-shimmer" />
                  <div className="h-3 w-1/3 rounded skeleton-shimmer" />
                </div>
                <div className="h-10 w-16 rounded-xl skeleton-shimmer" />
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 w-20 rounded-xl skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
