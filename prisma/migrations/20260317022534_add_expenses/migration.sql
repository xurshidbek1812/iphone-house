/*
  Warnings:

  - You are about to drop the column `approvedBy` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Expense` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expenseType` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "approvedBy",
DROP COLUMN "category",
DROP COLUMN "createdBy",
DROP COLUMN "currency",
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "createdById" INTEGER NOT NULL,
ADD COLUMN     "expenseType" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");

-- CreateIndex
CREATE INDEX "Expense_approvedById_idx" ON "Expense"("approvedById");

-- CreateIndex
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
