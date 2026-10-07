-- Sequence for quote codes (BG<number>). Same pattern as customer_code_seq
-- (20260922173800_customer_code_seq): nextval() is non-transactional, so a
-- rolled-back createQuote() transaction still burns the number — a quote
-- code, once handed out, is never reused. See QuoteService.nextQuoteCode().
CREATE SEQUENCE IF NOT EXISTS quote_code_seq AS BIGINT START WITH 1 INCREMENT BY 1;
