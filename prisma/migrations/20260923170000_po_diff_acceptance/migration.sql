-- CreateTable
CREATE TABLE "tbl_po_diff_acceptance" (
    "id" SERIAL NOT NULL,
    "po_id" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_po_diff_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_po_diff_acceptance_po_id_idx" ON "tbl_po_diff_acceptance"("po_id");

