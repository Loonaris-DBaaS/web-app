/*
  Warnings:

  - You are about to drop the `clusters` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DeploymentOption" AS ENUM ('MULTI_AZ_CLUSTER', 'MULTI_AZ_INSTANCE', 'SINGLE_AZ_INSTANCE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('provisioning', 'running', 'stopped', 'error', 'deleting');

-- DropTable
DROP TABLE "clusters";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "ClusterStatus";

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "country" TEXT,
    "password_hash" TEXT NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "k8s_namespace" TEXT NOT NULL,
    "pg_version" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "deployment_option" "DeploymentOption" NOT NULL,
    "estimated_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpu_usage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ram_usage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storage_usage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ProjectStatus" NOT NULL DEFAULT 'provisioning',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_configs" (
    "id" TEXT NOT NULL,
    "desired_replicas" INTEGER NOT NULL,
    "enable_backup" BOOLEAN NOT NULL DEFAULT false,
    "enable_autoscale" BOOLEAN NOT NULL DEFAULT false,
    "enable_pitr" BOOLEAN NOT NULL DEFAULT false,
    "desired_storage" TEXT NOT NULL,
    "desired_ram" TEXT NOT NULL,
    "desired_cpu" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "resource_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poolers" (
    "id" TEXT NOT NULL,
    "ro_pooler_link" TEXT NOT NULL,
    "rw_pooler_link" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "poolers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "project_id" TEXT NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_key" ON "tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_username_key" ON "tenant"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "projects_k8s_namespace_key" ON "projects"("k8s_namespace");

-- CreateIndex
CREATE UNIQUE INDEX "resource_configs_project_id_key" ON "resource_configs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_configs" ADD CONSTRAINT "resource_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poolers" ADD CONSTRAINT "poolers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
