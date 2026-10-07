-- I-1 (24/09/2026): nhận xét trên phiếu duyệt — chép prod tbl_approval_comments (SHOW CREATE TABLE
-- đo 24/09/2026). Dùng để ghi dấu THẤY ĐƯỢC "[VI] TRU VI THAT BAI: …" khi trừ ví lúc duyệt xong
-- không thành (prod viRutTienDuyetXong() ghi đúng câu này; bản port từng đánh rơi).
-- CHỈ tạo mới (enum + bảng + index) — không đụng bảng nào đang có.

-- CreateEnum
CREATE TYPE "ApprovalCommentType" AS ENUM ('comment', 'urge');

-- CreateTable
CREATE TABLE "tbl_approval_comments" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "commented_by" VARCHAR(50) NOT NULL,
    "comment_type" "ApprovalCommentType" NOT NULL DEFAULT 'comment',
    "comment" TEXT,
    "attachments" TEXT,
    "mentions" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "cdate" INTEGER NOT NULL,

    CONSTRAINT "tbl_approval_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_approval_comments_request_id_idx" ON "tbl_approval_comments"("request_id");
