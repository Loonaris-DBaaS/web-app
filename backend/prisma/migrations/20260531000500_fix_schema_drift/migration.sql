  
-- AlterTable
ALTER TABLE "poolers" DROP COLUMN "ro_pooler_link",
DROP COLUMN "rw_pooler_link",
ADD COLUMN     "ro_host" TEXT NOT NULL,
ADD COLUMN     "ro_port" INTEGER NOT NULL DEFAULT 5432,
ADD COLUMN     "rw_host" TEXT NOT NULL,
ADD COLUMN     "rw_port" INTEGER NOT NULL DEFAULT 5432;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "deployment_option";

-- AlterTable
ALTER TABLE "resource_configs" DROP COLUMN "desired_replicas",
ADD COLUMN     "instances" INTEGER NOT NULL DEFAULT 1;

-- DropEnum
DROP TYPE "DeploymentOption";

-- CreateIndex
CREATE UNIQUE INDEX "poolers_project_id_key" ON "poolers"("project_id");
