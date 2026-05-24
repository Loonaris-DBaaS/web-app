-- CreateEnum
CREATE TYPE "DeploymentOption" AS ENUM ('MULTI_AZ_CLUSTER', 'MULTI_AZ_INSTANCE', 'SINGLE_AZ_INSTANCE');

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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "estimated_price" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cpu_usage" DOUBLE PRECISION NOT NULL,
    "ram_usage" DOUBLE PRECISION NOT NULL,
    "storage_usage" DOUBLE PRECISION NOT NULL,
    "deployment_option" "DeploymentOption" NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ressource_configs" (
    "id" TEXT NOT NULL,
    "desired_replicas" SMALLINT NOT NULL,
    "enable_backup" BOOLEAN NOT NULL DEFAULT false,
    "enable_autoscale" BOOLEAN NOT NULL DEFAULT false,
    "enable_pitr" BOOLEAN NOT NULL DEFAULT false,
    "desired_storage" TEXT NOT NULL,
    "desired_ram" TEXT NOT NULL,
    "desired_cpu" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "ressource_configs_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "tenant_password_hash_key" ON "tenant"("password_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "projects_k8s_namespace_key" ON "projects"("k8s_namespace");

-- CreateIndex
CREATE UNIQUE INDEX "ressource_configs_project_id_key" ON "ressource_configs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ressource_configs" ADD CONSTRAINT "ressource_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poolers" ADD CONSTRAINT "poolers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
