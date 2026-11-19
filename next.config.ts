import path from 'path'
import type { NextConfig } from 'next'

// Cấu hình Next.js tối giản để deploy mượt mà trên Vercel Free & tách biệt gốc thư mục khỏi WikiHIS Desktop
const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // Tắt chạy nhầm cấu hình ESLint của Electron ở thư mục cha khi build; kiểm tra TypeScript vẫn bật đầy đủ
  eslint: {
    ignoreDuringBuilds: true
  }
}

export default nextConfig
