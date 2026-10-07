-- Q8 (24/09/2026): liên kết bút toán ví <-> giao dịch ngân hàng, chở nguyên từ prod
-- tbl_wallet_detail.tranId / trandetailId (bigint(20) NULL cả hai, đo từng cột). CHỈ ADD COLUMN.
-- AlterTable
ALTER TABLE "tbl_wallet_detail" ADD COLUMN     "tran_id" BIGINT,
ADD COLUMN     "trandetail_id" BIGINT;
