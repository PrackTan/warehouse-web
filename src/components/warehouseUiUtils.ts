import type { Warehouse5SStatus } from '@/lib/types'

/**
 * Tạo UUID duy nhất dùng cho Idempotency-Key chống gửi trùng khi mạng 4G chập chờn
 */
export function createClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Ẩn ghi chú seed mặc định từ bảng thống kê kho để giữ từng dòng Bill ngắn gọn nhất
 */
export function isDefaultSeedNote(note?: string): boolean {
  if (!note) return true
  const trimmed = note.trim()
  if (!trimmed) return true
  return /^(Thùng|Nhóm|Kệ thùng)\s+[\w-]+\s*\(STT\s+\d+\s*[—-]\s*Bảng thống kê kho\)$/i.test(
    trimmed
  )
}

/**
 * Nhãn trạng thái 5S theo phong cách Bill trắng đen tương phản cao
 */
export function getStatusMeta(status: Warehouse5SStatus): {
  label: string
  pillClass: string
} {
  if (status === 'repair') {
    return {
      label: 'CHỜ SỬA',
      pillClass: 'border border-dashed border-zinc-700 bg-zinc-100 text-zinc-900'
    }
  }
  if (status === 'scrap') {
    return {
      label: 'HỎNG / THANH LÝ',
      pillClass: 'border border-zinc-900 bg-zinc-200 text-zinc-900'
    }
  }
  return {
    label: 'DÙNG TỐT',
    pillClass: 'border border-zinc-300 bg-white text-zinc-800'
  }
}

/**
 * Chuẩn hóa tên phòng kho gọn nhẹ
 */
export function getRoomLabel(roomCode: string): string {
  return roomCode === 'working_room' ? 'Phòng Làm Việc IT' : 'Phòng Kho IT'
}
