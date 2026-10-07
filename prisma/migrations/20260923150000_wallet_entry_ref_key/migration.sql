-- AlterTable
ALTER TABLE "tbl_wallet_detail" ADD COLUMN     "ref_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tbl_wallet_detail_ref_key_key" ON "tbl_wallet_detail"("ref_key");

