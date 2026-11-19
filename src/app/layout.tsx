import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kho Thiết Bị & Vật Tư IT — BVĐK Tân Hưng',
  description: 'Tra cứu nhanh danh sách thiết bị trong thùng & Xuất/Nhập kho qua mã QR'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f9fafb'
}

/**
 * RootLayout: Khởi tạo font Geist Sans + Geist Mono và nền sáng Y tế (#f9fafb) theo chuẩn taste-skill
 */
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>): React.JSX.Element {
  return (
    <html lang="vi" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-[100dvh] bg-[#f9fafb] text-zinc-900 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </body>
    </html>
  )
}
