-- CreateEnum
CREATE TYPE "ClusterStatus" AS ENUM ('provisioning', 'running', 'stopped', 'error', 'deleting');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_apps" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "test_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clusters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "pg_version" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "deployment_option" TEXT NOT NULL,
    "read_replicas" INTEGER NOT NULL DEFAULT 1,
    "backup" BOOLEAN NOT NULL DEFAULT true,
    "status" "ClusterStatus" NOT NULL DEFAULT 'provisioning',
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clusters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
