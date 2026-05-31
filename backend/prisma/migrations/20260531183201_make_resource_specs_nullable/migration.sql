-- AlterTable
ALTER TABLE "resource_configs" ALTER COLUMN "desired_ram" DROP NOT NULL,
ALTER COLUMN "desired_cpu" DROP NOT NULL;
