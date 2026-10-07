-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('own', 'team', 'dept', 'dept_tree', 'warehouse', 'all');

-- CreateEnum
CREATE TYPE "PermKind" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "ScopeKind" AS ENUM ('warehouse', 'dept');

-- CreateTable
CREATE TABLE "tbl_user" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstname" TEXT,
    "lastname" TEXT,
    "email" TEXT,
    "gid" INTEGER,
    "phongban_id" INTEGER,
    "leader_id" INTEGER,
    "job_title_id" INTEGER,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "lastlogin" TIMESTAMP(3),
    "gsecret" TEXT,

    CONSTRAINT "tbl_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_perm" (
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "nhan_vn" TEXT,
    "mo_ta" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_perm_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "tbl_role" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "mo_ta" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cdate" INTEGER,

    CONSTRAINT "tbl_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_role_perm" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "perm_code" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,

    CONSTRAINT "tbl_role_perm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_user_role" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "hieu_luc_tu" DATE NOT NULL,
    "hieu_luc_den" DATE,
    "cap_boi" TEXT,
    "cdate" INTEGER,

    CONSTRAINT "tbl_user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_user_perm" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "perm_code" TEXT NOT NULL,
    "loai" "PermKind" NOT NULL,
    "scope" "Scope" NOT NULL,
    "ly_do" TEXT,
    "cap_boi" TEXT,
    "cdate" INTEGER,

    CONSTRAINT "tbl_user_perm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_user_scope" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "loai" "ScopeKind" NOT NULL,
    "gia_tri" TEXT NOT NULL,

    CONSTRAINT "tbl_user_scope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_phongban" (
    "id" SERIAL NOT NULL,
    "parent_id" INTEGER,
    "duong_dan" TEXT,
    "ma" TEXT,
    "ten" TEXT NOT NULL,
    "truong_phong_uid" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isactive" BOOLEAN NOT NULL DEFAULT true,
    "cdate" INTEGER,

    CONSTRAINT "tbl_phongban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_job_titles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "isactive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tbl_job_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "leader_id" INTEGER,
    "deputy_id" INTEGER,

    CONSTRAINT "tbl_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_saler_team" (
    "id" SERIAL NOT NULL,
    "saler" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "team_id" INTEGER,

    CONSTRAINT "tbl_saler_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_perm_cfg" (
    "ten" TEXT NOT NULL,
    "gia_tri" TEXT NOT NULL,

    CONSTRAINT "tbl_perm_cfg_pkey" PRIMARY KEY ("ten")
);

-- CreateTable
CREATE TABLE "tbl_login_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER,
    "username" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "cdate" INTEGER NOT NULL,

    CONSTRAINT "tbl_login_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_staff_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "hanh_dong" TEXT NOT NULL,
    "truoc_json" TEXT,
    "sau_json" TEXT,
    "boi" INTEGER,
    "luc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lydo" TEXT,

    CONSTRAINT "tbl_staff_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_user_username_key" ON "tbl_user"("username");

-- CreateIndex
CREATE INDEX "tbl_user_phongban_id_idx" ON "tbl_user"("phongban_id");

-- CreateIndex
CREATE INDEX "tbl_perm_module_idx" ON "tbl_perm"("module");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_role_code_key" ON "tbl_role"("code");

-- CreateIndex
CREATE INDEX "tbl_role_perm_perm_code_idx" ON "tbl_role_perm"("perm_code");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_role_perm_role_id_perm_code_key" ON "tbl_role_perm"("role_id", "perm_code");

-- CreateIndex
CREATE INDEX "tbl_user_role_user_id_idx" ON "tbl_user_role"("user_id");

-- CreateIndex
CREATE INDEX "tbl_user_perm_user_id_idx" ON "tbl_user_perm"("user_id");

-- CreateIndex
CREATE INDEX "tbl_user_scope_user_id_idx" ON "tbl_user_scope"("user_id");

-- CreateIndex
CREATE INDEX "tbl_phongban_parent_id_idx" ON "tbl_phongban"("parent_id");

-- CreateIndex
CREATE INDEX "tbl_phongban_duong_dan_idx" ON "tbl_phongban"("duong_dan");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_team_name_key" ON "tbl_team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_saler_team_saler_key" ON "tbl_saler_team"("saler");

-- CreateIndex
CREATE INDEX "tbl_login_log_username_idx" ON "tbl_login_log"("username");

-- CreateIndex
CREATE INDEX "tbl_staff_log_user_id_idx" ON "tbl_staff_log"("user_id");
