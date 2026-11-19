# Website QR Kho IT — WikiHIS (Vercel Free)

Website siêu nhẹ (Next.js App Router + `fetch()` Google Drive REST API thuần) giúp dùng sẵn **Camera điện thoại / Zalo** quét mã QR dán trên thùng Kho IT để xem ngay danh sách thiết bị bên trong và bấm Xuất / Nhập tồn kho tức thì.

## Hướng dẫn đưa lên Vercel Free (Chỉ 3 bước)

1. **Lấy khóa kết nối trên WikiHIS Desktop:**
   - Mở phần mềm WikiHIS trên máy tính (đã kết nối Google Drive).
   - Vào **Kho IT** → **In Nhãn QR Thùng (A4/A5)** → bấm **`Đồng bộ Web`** (để tạo tệp `db/warehouse_live.json` trên Google Drive).
   - Bấm **`Copy Khóa Vercel`** để chép chuỗi cấu hình `WIKIHIS_DRIVE_KEY`.

2. **Deploy lên Vercel Free (`https://vercel.com`):**
   - Bấm **Add New Project** → Chọn repo Git chứa WikiHIS.
   - Tại mục **Root Directory**, chọn thư mục **`warehouse-web`**.
   - Tại mục **Environment Variables**, thêm 1 biến duy nhất:
     - **Name:** `WIKIHIS_DRIVE_KEY`
     - **Value:** *(dán chuỗi vừa copy ở Bước 1)*
   - Bấm **Deploy**.

3. **Gắn tên miền Vercel vào Tem Nhãn QR:**
   - Copy đường dẫn Website Vercel vừa tạo (VD: `https://kho-it-tanhung.vercel.app`).
   - Dán vào ô **Link QR** trong cửa sổ **In Nhãn QR Thùng** trên WikiHIS Desktop và in tem dán thùng.
   - Phần mềm sẽ tự ghi nhớ link này cho các lần in sau.

