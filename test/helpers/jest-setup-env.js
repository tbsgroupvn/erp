// Chạy TRƯỚC mỗi tệp test (jest `setupFiles`).
//
// `PermGuard` chấp nhận header `x-uid` làm danh tính khi `NODE_ENV === 'test'`
// (lối tắt để spec đóng vai user mà không phải ký JWT). Jest tự đặt
// NODE_ENV='test', nên lối tắt đó BẬT trong test — đúng ý.
//
// Từ 23/09/2026 (F-5 của review cuối nhánh feat/api-dot1), `createApp()` TỪ
// CHỐI KHỞI ĐỘNG khi NODE_ENV==='test' mà không có cờ đồng ý tường minh này.
// Lý do: không có đường nào trong mã production đặt NODE_ENV cả
// (`npm run start:prod` là `node dist/main` trần), nên một container lỡ mang
// NODE_ENV=test từ image CI sẽ chạy server THẬT với cổng danh tính bằng header
// đang mở. Cờ dưới đây là chỗ DUY NHẤT nói "vâng, đây đúng là môi trường test".
process.env.ALLOW_TEST_IDENTITY_BYPASS = '1';

// ⚠⚠ Vế 2 (bắt buộc) của bản vá bẫy ĐỤNG KHOÁ CACHE `uid@version` —
// vế 1 nằm ở `resetIam()` trong test/helpers/iam-db.ts, đọc chú thích ở đó.
//
// `PermService.version()` memo hoá kết quả trong `PERM_VERSION_TTL_MS`
// (mặc định 5000ms). Hai ca test liên tiếp cách nhau chưa tới 5 giây, nên
// version MỚI do `resetIam()` ghi vào CSDL vẫn KHÔNG được đọc lại ⇒ khoá cache
// vẫn trùng ⇒ ca sau nhận bản đồ quyền của ca trước. Gỡ dòng này là bẫy sống
// lại, DÙ vế 1 còn nguyên (đã chứng minh bằng mutation test: bỏ riêng dòng này
// làm test/iam/reset-cache-collision.spec.ts ĐỎ).
//
// ⚠ ĐẶT Ở ĐÂY, KHÔNG PHẢI `.env.test`: `.env.test` bị `.gitignore` loại
// (.gitignore:4), nên cấu hình để ở đó KHÔNG đi theo repo — người copy repo về
// sẽ thiếu đúng nửa bản vá và bẫy quay lại ÂM THẦM. Tệp này thì được commit.
// `??=` để ai muốn thử TTL khác vẫn ghi đè được từ môi trường.
process.env.PERM_VERSION_TTL_MS ??= '0';

// Lượt quét phiếu duyệt (ApprovalSweepScheduler) chạy khi ứng dụng khởi động + định kỳ. Trong test,
// MỌI spec dựng ApprovalModule/AppModule đều sẽ khởi động nó ⇒ tắt mặc định để không có lượt quét
// nền chạy chen vào dữ liệu của spec khác. Spec kiểm lịch quét tự đặt lại biến này.
process.env.APPROVAL_SWEEP_INTERVAL_MS ??= '0';
