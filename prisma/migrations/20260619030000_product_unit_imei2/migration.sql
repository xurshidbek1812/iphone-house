-- AlterTable
ALTER TABLE "ProductUnit" ADD COLUMN     "imei2" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_imei2_key" ON "ProductUnit"("imei2");
