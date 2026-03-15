/*
  Warnings:

  - You are about to alter the column `balance` on the `Cashbox` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.

*/
-- AlterTable
ALTER TABLE "Cashbox" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(65,30);
