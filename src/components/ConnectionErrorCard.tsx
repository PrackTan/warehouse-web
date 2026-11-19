'use client'

import React from 'react'
import { ArrowsClockwise, WarningCircle } from '@phosphor-icons/react'

interface ConnectionErrorCardProps {
  errorMsg: string
  isRefreshing: boolean
  onRetry: () => void
}

/**
 * ConnectionErrorCard: Thẻ báo lỗi kết nối rõ ràng theo chuẩn Clean Clinical Light kèm 3 bước xử lý nhanh
 */
export const ConnectionErrorCard: React.FC<ConnectionErrorCardProps> = ({
  errorMsg,
  isRefreshing,
  onRetry
}) => {
  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.06)] space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
          <WarningCircle className="w-5 h-5" weight="duotone" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-bold tracking-tight text-zinc-900">
            Chưa kết nối được dữ liệu Kho IT
          </h2>
          <p className="text-sm text-rose-700 leading-relaxed">{errorMsg}</p>
        </div>
      </div>

      {/* Checklist kiểm tra nhanh giúp khắc phục trong 1 phút */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2 text-xs text-zinc-600 leading-relaxed">
        <div className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">
          Kiểm tra nhanh 3 bước:
        </div>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Trong <strong>WikiHIS Desktop → In Nhãn QR Thùng</strong>, bấm{' '}
            <strong>Copy Khóa Vercel</strong> để lấy chuỗi khóa mới nhất.
          </li>
          <li>
            Trên Vercel → <strong>Settings → Environment Variables</strong>, thêm biến tên{' '}
            <code className="font-mono font-semibold text-zinc-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              WIKIHIS_DRIVE_KEY
            </code>{' '}
            rồi vào tab <strong>Deployments → Redeploy</strong>.
          </li>
          <li>
            Quay lại WikiHIS Desktop bấm nút <strong>Đồng bộ Web</strong> 1 lần để tạo dữ liệu
            trên Google Drive.
          </li>
        </ol>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isRefreshing}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
      >
        <ArrowsClockwise
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          weight="bold"
        />
        <span>{isRefreshing ? 'Đang thử lại...' : 'Thử kết nối lại ngay'}</span>
      </button>
    </section>
  )
}
