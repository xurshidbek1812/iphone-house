/*
  Warnings:

  - You are about to drop the column `date` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `paidAmount` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `ContractItem` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the `Sale` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SaleItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[normalizedName]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cashboxId` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `ContractItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitPrice` to the `ContractItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payerType` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ContractItem" DROP CONSTRAINT "ContractItem_contractId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerAddress" DROP CONSTRAINT "CustomerAddress_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerDocument" DROP CONSTRAINT "CustomerDocument_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerJob" DROP CONSTRAINT "CustomerJob_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerPhone" DROP CONSTRAINT "CustomerPhone_customerId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_inventoryActId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_contractId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_userId_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_saleId_fkey";

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "date",
DROP COLUMN "paidAmount",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cashboxId" INTEGER NOT NULL,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyPayment" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "paymentDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "prepayment" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "debtAmount" SET DEFAULT 0,
ALTER COLUMN "durationMonths" SET DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "ContractItem" DROP COLUMN "price",
ADD COLUMN     "totalAmount" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "unitPrice" DECIMAL(65,30) NOT NULL,
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "InventoryAct" ADD COLUMN     "isStockUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "date",
DROP COLUMN "type",
ADD COLUMN     "cashboxId" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'UZS',
ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "method" TEXT NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "orderId" INTEGER,
ADD COLUMN     "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "partnerId" INTEGER,
ADD COLUMN     "payerType" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'POSTED',
ADD COLUMN     "userId" INTEGER,
ALTER COLUMN "contractId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "buyCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "normalizedName" TEXT,
ADD COLUMN     "saleCurrency" TEXT NOT NULL DEFAULT 'UZS';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "customId" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cashboxId" INTEGER,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'NAQD',
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "referenceId" INTEGER,
ALTER COLUMN "category" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- DropTable
DROP TABLE "Sale";

-- DropTable
DROP TABLE "SaleItem";

-- CreateTable
CREATE TABLE "BlacklistRequest" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "approverName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Jarayonda',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlacklistRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "supplierInvoiceId" INTEGER,
    "supplierInvoiceItemId" INTEGER,
    "initialQty" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reservedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION,
    "buyCurrency" TEXT NOT NULL DEFAULT 'USD',
    "supplierName" TEXT,
    "invoiceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "batchId" INTEGER,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DECIMAL(65,30),
    "unitPrice" DECIMAL(65,30),
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER,
    "supplierName" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSum" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 12500,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'Jarayonda',
    "userName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceItem" (
    "id" SERIAL NOT NULL,
    "supplierInvoiceId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "customId" INTEGER,
    "name" TEXT NOT NULL,
    "count" DOUBLE PRECISION NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "salePrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "markup" DOUBLE PRECISION,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SupplierInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "balanceSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerLedger" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "PartnerLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "customerId" INTEGER,
    "partnerId" INTEGER,
    "userId" INTEGER NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dueAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    "otherName" TEXT,
    "otherPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemBatchAllocation" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DECIMAL(65,30),
    "unitPrice" DECIMAL(65,30),

    CONSTRAINT "OrderItemBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItemBatchAllocation" (
    "id" SERIAL NOT NULL,
    "contractItemId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DECIMAL(65,30),
    "unitPrice" DECIMAL(65,30),

    CONSTRAINT "ContractItemBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractCoBorrower" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractCoBorrower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSchedule" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'KUTILMOQDA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractComment" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "userId" INTEGER,
    "authorName" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cashbox" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cashbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" SERIAL NOT NULL,
    "cashboxId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "type" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Return" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "customerId" INTEGER,
    "partnerId" INTEGER,
    "userId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "batchId" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DECIMAL(65,30),
    "totalAmount" DECIMAL(65,30),

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "entityType" TEXT,
    "entityId" INTEGER,
    "status" TEXT,
    "amount" DECIMAL(65,30) DEFAULT 0,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "ProductBatch_productId_idx" ON "ProductBatch"("productId");

-- CreateIndex
CREATE INDEX "ProductBatch_supplierId_idx" ON "ProductBatch"("supplierId");

-- CreateIndex
CREATE INDEX "ProductBatch_supplierInvoiceId_idx" ON "ProductBatch"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");

-- CreateIndex
CREATE INDEX "StockMovement_sourceType_sourceId_idx" ON "StockMovement"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_invoiceNumber_idx" ON "SupplierInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierInvoiceItem_supplierInvoiceId_idx" ON "SupplierInvoiceItem"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceItem_productId_idx" ON "SupplierInvoiceItem"("productId");

-- CreateIndex
CREATE INDEX "PartnerLedger_partnerId_idx" ON "PartnerLedger"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerLedger_sourceType_sourceId_idx" ON "PartnerLedger"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "PartnerLedger_createdAt_idx" ON "PartnerLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_partnerId_idx" ON "Order"("partnerId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItemBatchAllocation_orderItemId_idx" ON "OrderItemBatchAllocation"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemBatchAllocation_batchId_idx" ON "OrderItemBatchAllocation"("batchId");

-- CreateIndex
CREATE INDEX "ContractItemBatchAllocation_contractItemId_idx" ON "ContractItemBatchAllocation"("contractItemId");

-- CreateIndex
CREATE INDEX "ContractItemBatchAllocation_batchId_idx" ON "ContractItemBatchAllocation"("batchId");

-- CreateIndex
CREATE INDEX "ContractCoBorrower_contractId_idx" ON "ContractCoBorrower"("contractId");

-- CreateIndex
CREATE INDEX "ContractCoBorrower_customerId_idx" ON "ContractCoBorrower"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractCoBorrower_contractId_customerId_key" ON "ContractCoBorrower"("contractId", "customerId");

-- CreateIndex
CREATE INDEX "ContractSchedule_contractId_idx" ON "ContractSchedule"("contractId");

-- CreateIndex
CREATE INDEX "ContractSchedule_date_idx" ON "ContractSchedule"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ContractSchedule_contractId_monthNumber_key" ON "ContractSchedule"("contractId", "monthNumber");

-- CreateIndex
CREATE INDEX "ContractComment_contractId_idx" ON "ContractComment"("contractId");

-- CreateIndex
CREATE INDEX "ContractComment_userId_idx" ON "ContractComment"("userId");

-- CreateIndex
CREATE INDEX "ContractComment_createdAt_idx" ON "ContractComment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cashbox_name_key" ON "Cashbox"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_paymentId_key" ON "CashTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "CashTransaction_cashboxId_idx" ON "CashTransaction"("cashboxId");

-- CreateIndex
CREATE INDEX "CashTransaction_sourceType_sourceId_idx" ON "CashTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CashTransaction_createdAt_idx" ON "CashTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "Return_orderId_idx" ON "Return"("orderId");

-- CreateIndex
CREATE INDEX "Return_customerId_idx" ON "Return"("customerId");

-- CreateIndex
CREATE INDEX "Return_partnerId_idx" ON "Return"("partnerId");

-- CreateIndex
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ReturnItem_productId_idx" ON "ReturnItem"("productId");

-- CreateIndex
CREATE INDEX "ReturnItem_batchId_idx" ON "ReturnItem"("batchId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");

-- CreateIndex
CREATE INDEX "Contract_cashboxId_idx" ON "Contract"("cashboxId");

-- CreateIndex
CREATE INDEX "Contract_userId_idx" ON "Contract"("userId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_createdAt_idx" ON "Contract"("createdAt");

-- CreateIndex
CREATE INDEX "ContractItem_contractId_idx" ON "ContractItem"("contractId");

-- CreateIndex
CREATE INDEX "ContractItem_productId_idx" ON "ContractItem"("productId");

-- CreateIndex
CREATE INDEX "InventoryAct_date_idx" ON "InventoryAct"("date");

-- CreateIndex
CREATE INDEX "InventoryItem_inventoryActId_idx" ON "InventoryItem"("inventoryActId");

-- CreateIndex
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_partnerId_idx" ON "Payment"("partnerId");

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- CreateIndex
CREATE INDEX "Payment_cashboxId_idx" ON "Payment"("cashboxId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_normalizedName_key" ON "Product"("normalizedName");

-- CreateIndex
CREATE INDEX "Transaction_cashboxId_idx" ON "Transaction"("cashboxId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- AddForeignKey
ALTER TABLE "BlacklistRequest" ADD CONSTRAINT "BlacklistRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPhone" ADD CONSTRAINT "CustomerPhone_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerJob" ADD CONSTRAINT "CustomerJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_supplierInvoiceItemId_fkey" FOREIGN KEY ("supplierInvoiceItemId") REFERENCES "SupplierInvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceItem" ADD CONSTRAINT "SupplierInvoiceItem_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceItem" ADD CONSTRAINT "SupplierInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLedger" ADD CONSTRAINT "PartnerLedger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLedger" ADD CONSTRAINT "PartnerLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemBatchAllocation" ADD CONSTRAINT "OrderItemBatchAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemBatchAllocation" ADD CONSTRAINT "OrderItemBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemBatchAllocation" ADD CONSTRAINT "ContractItemBatchAllocation_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItemBatchAllocation" ADD CONSTRAINT "ContractItemBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractCoBorrower" ADD CONSTRAINT "ContractCoBorrower_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractCoBorrower" ADD CONSTRAINT "ContractCoBorrower_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSchedule" ADD CONSTRAINT "ContractSchedule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractComment" ADD CONSTRAINT "ContractComment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractComment" ADD CONSTRAINT "ContractComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAct" ADD CONSTRAINT "InventoryAct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryActId_fkey" FOREIGN KEY ("inventoryActId") REFERENCES "InventoryAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
