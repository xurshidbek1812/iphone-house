/*
  Warnings:

  - You are about to drop the column `expenseType` on the `Expense` table. All the data in the column will be lost.
  - Added the required column `expenseCategoryId` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "expenseType",
ADD COLUMN     "expenseCategoryId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ExpenseCategoryGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategoryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategoryGroup_name_key" ON "ExpenseCategoryGroup"("name");

-- CreateIndex
CREATE INDEX "ExpenseCategoryGroup_name_idx" ON "ExpenseCategoryGroup"("name");

-- CreateIndex
CREATE INDEX "ExpenseCategory_groupId_idx" ON "ExpenseCategory"("groupId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_name_idx" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_groupId_name_key" ON "ExpenseCategory"("groupId", "name");

-- CreateIndex
CREATE INDEX "Expense_expenseCategoryId_idx" ON "Expense"("expenseCategoryId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ExpenseCategoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
