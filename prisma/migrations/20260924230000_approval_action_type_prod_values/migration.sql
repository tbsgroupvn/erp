-- D4 — ActionType thiếu 5 giá trị so với miền enum prod tbl_approval_actions.action
-- (sql_nhpcn, information_schema.columns, 24/09/2026):
--   enum('approve','reject','transfer','return','add_approver','remove_approver','auto_approve',
--        'auto_reject','revoke','modify_submit','modify_approve','modify_reject','stuck_no_approver',
--        'return_submitter','resubmit','fx_adjust')
-- stuck_no_approver có 8 dòng thật (4 trên phiếu còn tồn tại) ⇒ thiếu thì INSERT lúc migrate vỡ.
--
-- Viết TAY (không lấy nguyên xi `prisma migrate diff`): chỉ THÊM giá trị, không DROP/đổi kiểu gì.
-- `IF NOT EXISTS` ⇒ chạy lại / đụng nhánh khác cũng thêm giá trị này thì không lỗi.
-- Postgres ≥ 12 cho ADD VALUE trong khối transaction; giới hạn duy nhất là giá trị mới chưa DÙNG được
-- trong cùng transaction — migration này không dùng tới chúng.
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'modify_submit';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'modify_approve';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'modify_reject';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'stuck_no_approver';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'fx_adjust';
