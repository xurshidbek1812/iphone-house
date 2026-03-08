/*
  Warnings:

  - You are about to drop the column `barcode` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `costPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `measureUnit` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `sellPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `stockQuantity` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[customId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `customId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropIndex
DROP INDEX "Product_barcode_key";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "barcode",
DROP COLUMN "categoryId",
DROP COLUMN "costPrice",
DROP COLUMN "measureUnit",
DROP COLUMN "sellPrice",
DROP COLUMN "stockQuantity",
ADD COLUMN     "buyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "customId" INTEGER NOT NULL,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "salePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'Dona';

-- DropTable
DROP TABLE "Category";

-- CreateIndex
CREATE UNIQUE INDEX "Product_customId_key" ON "Product"("customId");
