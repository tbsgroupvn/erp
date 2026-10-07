-- AlterTable
ALTER TABLE "tbl_ncc" ADD COLUMN     "cdate" INTEGER,
ADD COLUMN     "industry" VARCHAR(200),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "qr_image" VARCHAR(255),
ADD COLUMN     "udate" INTEGER,
ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "tbl_ncc_vn" ADD COLUMN     "cdate" INTEGER,
ADD COLUMN     "created_by" VARCHAR(50),
ADD COLUMN     "note" VARCHAR(500);
