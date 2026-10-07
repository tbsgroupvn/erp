#!/usr/bin/env node
/**
 * Cài hook từ `hooks/` vào `.git/hooks/`.
 *
 * ⚠ `.git/hooks/` KHÔNG được git theo dõi, nên hook không tự đi theo repo.
 * Vì repo này không có remote (và không được phép có — cấu hình chứa mật khẩu
 * CSDL), "clone mới" ở đây nghĩa là copy thư mục. Người copy sẽ KHÔNG có hook
 * cho tới khi chạy `npm run hooks:install`. Đó là lý do lệnh này gắn vào
 * `postinstall`: ai chạy `npm install` là có hook, không phải nhớ thêm bước.
 *
 * CHÉP chứ không symlink: symlink trên Windows cần quyền đặc biệt và im lặng
 * hỏng trong Git Bash/MSYS. Chép thì phải chạy lại lệnh này khi sửa hook —
 * đánh đổi có chủ ý, đổi lấy việc nó CHẠY ĐƯỢC ở mọi máy.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'hooks');
const dst = path.join(root, '.git', 'hooks');

if (!fs.existsSync(dst)) {
  // Không phải bản làm việc git (ví dụ cài trong Docker build) — không có gì để làm.
  console.log('[hooks] .git/hooks không tồn tại — bỏ qua.');
  process.exit(0);
}

for (const name of fs.readdirSync(src)) {
  const from = path.join(src, name);
  const to = path.join(dst, name);
  fs.copyFileSync(from, to);
  try {
    fs.chmodSync(to, 0o755); // vô hại trên Windows, bắt buộc trên Linux/macOS
  } catch {
    /* hệ tệp không hỗ trợ chmod */
  }
  console.log(`[hooks] đã cài ${name}`);
}
