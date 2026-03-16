-- Migration: Chat Module — Direct Message + Group Chat
-- Creates: chat_conversations, chat_participants, chat_messages tables
-- Enums: ConversationType, MessageStatus

-- Enums
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'EDITED', 'DELETED');

-- chat_conversations
CREATE TABLE "chat_conversations" (
  "id"             TEXT NOT NULL,
  "type"           "ConversationType" NOT NULL,
  "name"           TEXT,
  "created_by"     TEXT NOT NULL,
  "reference_type" TEXT,
  "reference_id"   TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_conversations_created_by_idx"          ON "chat_conversations"("created_by");
CREATE INDEX "chat_conversations_type_idx"                ON "chat_conversations"("type");
CREATE INDEX "chat_conversations_reference_type_id_idx"   ON "chat_conversations"("reference_type", "reference_id");

-- chat_participants
CREATE TABLE "chat_participants" (
  "id"              TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "role"            TEXT NOT NULL DEFAULT 'MEMBER',
  "last_read_at"    TIMESTAMP(3),
  "joined_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at"         TIMESTAMP(3),
  "is_muted"        BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_participants_conversation_id_user_id_key"
  ON "chat_participants"("conversation_id", "user_id");
CREATE INDEX "chat_participants_user_id_idx"
  ON "chat_participants"("user_id");
CREATE INDEX "chat_participants_conversation_id_user_id_idx"
  ON "chat_participants"("conversation_id", "user_id");

ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_conversation_id_fkey"
  FOREIGN KEY ("conversation_id")
  REFERENCES "chat_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- chat_messages
CREATE TABLE "chat_messages" (
  "id"              TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "sender_id"       TEXT NOT NULL,
  "content"         TEXT NOT NULL,
  "status"          "MessageStatus" NOT NULL DEFAULT 'SENT',
  "reply_to_id"     TEXT,
  "edited_at"       TIMESTAMP(3),
  "deleted_at"      TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_conversation_id_created_at_idx"
  ON "chat_messages"("conversation_id", "created_at");
CREATE INDEX "chat_messages_sender_id_idx"
  ON "chat_messages"("sender_id");

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id")
  REFERENCES "chat_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_reply_to_id_fkey"
  FOREIGN KEY ("reply_to_id")
  REFERENCES "chat_messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
