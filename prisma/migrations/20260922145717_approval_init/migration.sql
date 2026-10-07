-- CreateEnum
CREATE TYPE "ApprovalNodeType" AS ENUM ('AND', 'OR', 'SEQ');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('manual', 'auto_approve', 'auto_reject');

-- CreateEnum
CREATE TYPE "EmptyApproverAction" AS ENUM ('auto_approve', 'to_user', 'to_admin');

-- CreateEnum
CREATE TYPE "SelfApprovalAction" AS ENUM ('self', 'skip', 'to_user');

-- CreateEnum
CREATE TYPE "ApproverType" AS ENUM ('group', 'user', 'submitter_manager', 'requester', 'self_select', 'step_approver');

-- CreateEnum
CREATE TYPE "DedupMode" AS ENUM ('auto_all', 'auto_consecutive', 'none');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('approve', 'reject', 'transfer', 'return', 'add_approver', 'remove_approver', 'auto_approve', 'auto_reject', 'revoke', 'return_submitter', 'resubmit');

-- CreateEnum
CREATE TYPE "RequestApproverChange" AS ENUM ('transfer_in', 'added', 'excluded');

-- CreateTable
CREATE TABLE "tbl_approval_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "category" TEXT,
    "isactive" BOOLEAN NOT NULL DEFAULT true,
    "approver_dedup_mode" "DedupMode" NOT NULL DEFAULT 'auto_all',
    "allow_revoke_pending" BOOLEAN NOT NULL DEFAULT false,
    "allow_batch" BOOLEAN NOT NULL DEFAULT false,
    "prohibit_admin_manage" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "cdate" INTEGER,

    CONSTRAINT "tbl_approval_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_steps" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL,
    "step_name" TEXT,
    "node_type" "ApprovalNodeType" NOT NULL DEFAULT 'OR',
    "branch_id" INTEGER,
    "approval_mode" "ApprovalMode" NOT NULL DEFAULT 'manual',
    "require_comment" BOOLEAN NOT NULL DEFAULT false,
    "allow_transfer" BOOLEAN NOT NULL DEFAULT true,
    "allow_return" BOOLEAN NOT NULL DEFAULT true,
    "empty_approver_action" "EmptyApproverAction" NOT NULL DEFAULT 'to_admin',
    "empty_approver_ref" INTEGER,
    "self_approval_action" "SelfApprovalAction" NOT NULL DEFAULT 'skip',
    "self_approval_ref" INTEGER,

    CONSTRAINT "tbl_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_step_approvers" (
    "id" SERIAL NOT NULL,
    "step_id" INTEGER NOT NULL,
    "approver_type" "ApproverType" NOT NULL,
    "approver_ref" INTEGER,

    CONSTRAINT "tbl_approval_step_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_branch_groups" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,

    CONSTRAINT "tbl_approval_branch_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_branches" (
    "id" SERIAL NOT NULL,
    "branch_group_id" INTEGER NOT NULL,
    "branch_name" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "condition_json" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tbl_approval_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_form_fields" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "field_key" TEXT NOT NULL,
    "label" TEXT,
    "field_type" TEXT NOT NULL,
    "options_json" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visibility_json" TEXT,

    CONSTRAINT "tbl_approval_form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_requests" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" INTEGER NOT NULL,
    "object_code" TEXT,
    "current_step_order" INTEGER NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" INTEGER NOT NULL,
    "pending_since" INTEGER,
    "finished_at" INTEGER,
    "form_data" TEXT,
    "resolved_branch_id" INTEGER,
    "submitted_on_behalf_by" TEXT,
    "no_auto_dedup" BOOLEAN NOT NULL DEFAULT false,
    "modified_once" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "synced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tbl_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_actions" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL,
    "step_name" TEXT,
    "action" "ActionType" NOT NULL,
    "acted_by" TEXT NOT NULL,
    "acted_by_uid" INTEGER,
    "acted_at" INTEGER NOT NULL,
    "note" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "admin_override" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tbl_approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_approval_request_approvers" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "change_type" "RequestApproverChange" NOT NULL,
    "replaced_username" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tbl_approval_request_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_approval_templates_code_key" ON "tbl_approval_templates"("code");

-- CreateIndex
CREATE INDEX "tbl_approval_templates_object_type_idx" ON "tbl_approval_templates"("object_type");

-- CreateIndex
CREATE INDEX "tbl_approval_steps_template_id_idx" ON "tbl_approval_steps"("template_id");

-- CreateIndex
CREATE INDEX "tbl_approval_step_approvers_step_id_idx" ON "tbl_approval_step_approvers"("step_id");

-- CreateIndex
CREATE INDEX "tbl_approval_branches_branch_group_id_idx" ON "tbl_approval_branches"("branch_group_id");

-- CreateIndex
CREATE INDEX "tbl_approval_form_fields_template_id_idx" ON "tbl_approval_form_fields"("template_id");

-- CreateIndex
CREATE INDEX "tbl_approval_requests_object_type_idx" ON "tbl_approval_requests"("object_type");

-- CreateIndex
CREATE INDEX "tbl_approval_requests_status_idx" ON "tbl_approval_requests"("status");

-- CreateIndex
CREATE INDEX "tbl_approval_actions_request_id_idx" ON "tbl_approval_actions"("request_id");

-- CreateIndex
CREATE INDEX "tbl_approval_request_approvers_request_id_idx" ON "tbl_approval_request_approvers"("request_id");

-- AddForeignKey
ALTER TABLE "tbl_approval_steps" ADD CONSTRAINT "tbl_approval_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "tbl_approval_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_approval_step_approvers" ADD CONSTRAINT "tbl_approval_step_approvers_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "tbl_approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_approval_branches" ADD CONSTRAINT "tbl_approval_branches_branch_group_id_fkey" FOREIGN KEY ("branch_group_id") REFERENCES "tbl_approval_branch_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
