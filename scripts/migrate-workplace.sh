#!/bin/bash
# Migration script for TBS Workplace Phase 1
# Run from project root: bash scripts/migrate-workplace.sh

set -e
cd tbs-erp-backend

echo "=== Running Prisma migrations for Workplace Phase 1 ==="
echo "New models: ChatReaction, CalendarEvent, EventParticipant, EventReminder, MeetingRoom"
echo "New models: CompanyPost, PostReaction, PostComment"
echo "New models: DriveFolder, DriveFile, DriveFileVersion, DriveFileShare"
echo "Modified: ChatConversation (pinnedMessageId), ChatMessage (reactions)"

# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate dev --name workplace_phase1 --schema prisma/schema.prisma

echo "=== Migration complete ==="
echo "Next steps:"
echo "  1. Run: npm install (in tbs-erp-backend)"
echo "  2. Run: npm install (in tbs-erp-frontend)"
echo "  3. Start MinIO: docker compose -f ../docker-compose.dev.yml up minio -d"
echo "  4. Create MinIO buckets: tbs-drive, tbs-chat, tbs-media"
