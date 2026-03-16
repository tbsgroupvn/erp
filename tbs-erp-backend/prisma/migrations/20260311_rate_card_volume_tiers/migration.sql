-- CreateTable: rate_card_volume_tiers
-- Gia theo san luong (volume tier pricing) cho moi rate card
CREATE TABLE "rate_card_volume_tiers" (
    "id"           TEXT NOT NULL,
    "rate_card_id" TEXT NOT NULL,
    "min_weight"   DECIMAL(10,2) NOT NULL,
    "max_weight"   DECIMAL(10,2),
    "discount_pct" DECIMAL(5,2)  NOT NULL,
    "fixed_price"  DECIMAL(18,2),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_card_volume_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_card_volume_tiers_rate_card_id_idx"
    ON "rate_card_volume_tiers"("rate_card_id");

-- AddForeignKey
ALTER TABLE "rate_card_volume_tiers"
    ADD CONSTRAINT "rate_card_volume_tiers_rate_card_id_fkey"
    FOREIGN KEY ("rate_card_id")
    REFERENCES "rate_cards"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
