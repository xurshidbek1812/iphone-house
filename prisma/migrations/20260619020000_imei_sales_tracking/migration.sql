-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "imeis" JSONB;

-- AlterTable
ALTER TABLE "ProductUnit" ADD COLUMN     "orderItemId" INTEGER,
ADD COLUMN     "soldAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ProductUnit_orderItemId_idx" ON "ProductUnit"("orderItemId");

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
