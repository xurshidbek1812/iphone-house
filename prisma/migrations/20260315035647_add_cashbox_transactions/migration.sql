-- CreateTable
CREATE TABLE "CashboxTransaction" (
    "id" SERIAL NOT NULL,
    "cashboxId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "CashboxTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashboxTransaction_cashboxId_idx" ON "CashboxTransaction"("cashboxId");

-- CreateIndex
CREATE INDEX "CashboxTransaction_createdAt_idx" ON "CashboxTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "CashboxTransaction" ADD CONSTRAINT "CashboxTransaction_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxTransaction" ADD CONSTRAINT "CashboxTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
