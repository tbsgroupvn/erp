-- Sequence for customer codes (TBS<number>). Faithful equivalent of prod's
-- MySQL "ticket table" (INSERT -> LastInsertID -> DELETE): nextval() is
-- non-transactional, so a rolled-back transaction still burns the number.
-- A code, once handed out, is never reused.
CREATE SEQUENCE IF NOT EXISTS customer_code_seq AS BIGINT START WITH 1 INCREMENT BY 1;
