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
 * Ẩn ghi chú seed mặc định từ bảng thống kê kho để danh sách vật tư sạch sẽ, không rối chữ
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
 * Trả về nhãn và bảng màu chuẩn Y tế cho trạng thái 5S trên nền sáng
 */
export function getStatusMeta(status: Warehouse5SStatus): {
  label: string
  pillClass: string
  dotClass: string
} {
  if (status === 'repair') {
    return {
      label: 'Chờ sửa',
      pillClass: 'bg-amber-50 text-amber-800 border-amber-200/90',
      dotClass: 'bg-amber-500'
    }
  }
  if (status === 'scrap') {
    return {
      label: 'Hỏng / Thanh lý',
      pillClass: 'bg-rose-50 text-rose-800 border-rose-200/90',
      dotClass: 'bg-rose-500'
    }
  }
  return {
    label: 'Dùng tốt',
    pillClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
    dotClass: 'bg-emerald-500'
  }
}

/**
 * Chuẩn hóa tên phòng kho dễ đọc trên điện thoại
 */
export function getRoomLabel(roomCode: string): string {
  return roomCode === 'working_room' ? 'Phòng Làm Việc IT' : 'Phòng Kho IT'
}
