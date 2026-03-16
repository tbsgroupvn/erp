-- CreateEnum: AssignmentStatus
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SKIPPED', 'ESCALATED');

-- CreateTable: order_stage_configs
CREATE TABLE "order_stage_configs" (
    "id" TEXT NOT NULL,
    "stage" "OrderStatus" NOT NULL,
    "department_code" TEXT NOT NULL,
    "primary_roles" "UserRole"[],
    "sla_hours" INTEGER NOT NULL,
    "sla_warning_hours" INTEGER,
    "task_title" TEXT NOT NULL,
    "task_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_stage_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_stage_configs_stage_key" ON "order_stage_configs"("stage");
CREATE INDEX "order_stage_configs_department_code_idx" ON "order_stage_configs"("department_code");

-- CreateTable: order_assignments
CREATE TABLE "order_assignments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "stage" "OrderStatus" NOT NULL,
    "department_code" TEXT NOT NULL,
    "assignee_id" TEXT,
    "assignee_role" "UserRole" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "sla_deadline" TIMESTAMP(3),
    "is_overdue" BOOLEAN NOT NULL DEFAULT false,
    "auto_task_id" TEXT,

    CONSTRAINT "order_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_assignments_order_id_stage_assignee_role_key" ON "order_assignments"("order_id", "stage", "assignee_role");
CREATE INDEX "order_assignments_order_id_status_idx" ON "order_assignments"("order_id", "status");
CREATE INDEX "order_assignments_assignee_id_status_idx" ON "order_assignments"("assignee_id", "status");
CREATE INDEX "order_assignments_department_code_status_idx" ON "order_assignments"("department_code", "status");
CREATE INDEX "order_assignments_sla_deadline_is_overdue_idx" ON "order_assignments"("sla_deadline", "is_overdue");

ALTER TABLE "order_assignments" ADD CONSTRAINT "order_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: order_handoffs
CREATE TABLE "order_handoffs" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_stage" "OrderStatus" NOT NULL,
    "to_stage" "OrderStatus" NOT NULL,
    "from_department" TEXT NOT NULL,
    "to_department" TEXT NOT NULL,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "to_role" "UserRole" NOT NULL,
    "handoff_type" TEXT NOT NULL DEFAULT 'STAGE_TRANSITION',
    "note" TEXT,
    "duration_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_handoffs_order_id_created_at_idx" ON "order_handoffs"("order_id", "created_at");

ALTER TABLE "order_handoffs" ADD CONSTRAINT "order_handoffs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: tasks - Add order-project fields
ALTER TABLE "tasks" ADD COLUMN "source_type" TEXT;
ALTER TABLE "tasks" ADD COLUMN "order_stage" TEXT;
ALTER TABLE "tasks" ADD COLUMN "department_code" TEXT;
ALTER TABLE "tasks" ADD COLUMN "is_auto_created" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "tasks_entity_type_entity_id_order_stage_idx" ON "tasks"("entityType", "entityId", "order_stage");
CREATE INDEX "tasks_department_code_status_idx" ON "tasks"("department_code", "status");
