-- ============================================
-- Migration: AI Chat Module
-- Created: 2026-03-08
-- ============================================

-- Table: ai_chat_sessions
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- Table: ai_messages
CREATE TABLE IF NOT EXISTS "ai_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_id_idx" ON "ai_chat_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "ai_messages_session_id_idx" ON "ai_messages"("session_id");

-- Foreign key
ALTER TABLE "ai_messages"
    ADD CONSTRAINT "ai_messages_session_id_fkey"
    FOREIGN KEY ("session_id")
    REFERENCES "ai_chat_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
