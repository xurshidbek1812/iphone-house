-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- Seed default warehouse
INSERT INTO "Warehouse" ("name", "isActive", "createdAt", "updatedAt")
VALUES ('Asosiy', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: ProductBatch gets warehouseId, backfilled to Asosiy, then enforced NOT NULL
ALTER TABLE "ProductBatch" ADD COLUMN "warehouseId" INTEGER;

UPDATE "ProductBatch" b
SET "warehouseId" = w.id
FROM "Warehouse" w
WHERE w.name = 'Asosiy';

ALTER TABLE "ProductBatch" ALTER COLUMN "warehouseId" SET NOT NULL;

CREATE INDEX "ProductBatch_warehouseId_idx" ON "ProductBatch"("warehouseId");

ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SupplierInvoice gets warehouseId, nullable, backfilled only for in-flight invoices
ALTER TABLE "SupplierInvoice" ADD COLUMN "warehouseId" INTEGER;

UPDATE "SupplierInvoice" si
SET "warehouseId" = w.id
FROM "Warehouse" w
WHERE w.name = 'Asosiy'
  AND si.status IN ('Jarayonda', 'Yuborildi');

CREATE INDEX "SupplierInvoice_warehouseId_idx" ON "SupplierInvoice"("warehouseId");

ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Order gets warehouseId (nullable, no backfill needed for historical orders)
ALTER TABLE "Order" ADD COLUMN "warehouseId" INTEGER;

CREATE INDEX "Order_warehouseId_idx" ON "Order"("warehouseId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: OrderItem gets batchId (nullable, no backfill needed for historical items)
ALTER TABLE "OrderItem" ADD COLUMN "batchId" INTEGER;

CREATE INDEX "OrderItem_batchId_idx" ON "OrderItem"("batchId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "fromWarehouseId" INTEGER NOT NULL,
    "toWarehouseId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "imeis" JSONB,
    "note" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransfer_productId_idx" ON "StockTransfer"("productId");

-- CreateIndex
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
