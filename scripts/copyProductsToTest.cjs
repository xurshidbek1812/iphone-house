require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const sourceDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SOURCE_DATABASE_URL
    }
  }
});

const targetDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Source DB:', process.env.SOURCE_DATABASE_URL);
  console.log('Target DB:', process.env.DATABASE_URL);

  // 1. Cashbox
  const cashboxes = await sourceDb.cashbox.findMany();
  for (const cashbox of cashboxes) {
    const exists = await targetDb.cashbox.findFirst({
      where: { name: cashbox.name }
    });

    if (!exists) {
      await targetDb.cashbox.create({
        data: {
          name: cashbox.name,
          balance: cashbox.balance,
          currency: cashbox.currency
        }
      });
    }
  }

  // 2. Products
  const products = await sourceDb.product.findMany({
    orderBy: { id: 'asc' }
  });

  for (const product of products) {
    const exists = await targetDb.product.findUnique({
      where: { customId: product.customId }
    });

    if (!exists) {
      await targetDb.product.create({
        data: {
          customId: product.customId,
          name: product.name,
          normalizedName: product.normalizedName,
          category: product.category,
          unit: product.unit,
          buyPrice: product.buyPrice,
          salePrice: product.salePrice,
          quantity: product.quantity,
          buyCurrency: product.buyCurrency,
          saleCurrency: product.saleCurrency,
          createdAt: product.createdAt
        }
      });
    }
  }

  // 3. ProductBatch
  const sourceProducts = await sourceDb.product.findMany({
    include: {
      batches: true
    }
  });

  for (const sourceProduct of sourceProducts) {
    const targetProduct = await targetDb.product.findUnique({
      where: { customId: sourceProduct.customId }
    });

    if (!targetProduct) continue;

    for (const batch of sourceProduct.batches) {
      const exists = await targetDb.productBatch.findFirst({
        where: {
          productId: targetProduct.id,
          createdAt: batch.createdAt,
          buyPrice: batch.buyPrice,
          initialQty: batch.initialQty
        }
      });

      if (!exists) {
        await targetDb.productBatch.create({
          data: {
            productId: targetProduct.id,
            initialQty: batch.initialQty,
            quantity: batch.quantity,
            reservedQty: batch.reservedQty || 0,
            buyPrice: batch.buyPrice,
            salePrice: batch.salePrice,
            buyCurrency: batch.buyCurrency,
            supplierName: batch.supplierName,
            invoiceNumber: batch.invoiceNumber,
            createdAt: batch.createdAt,
            isArchived: batch.isArchived || false,
            note: batch.note
          }
        });
      }
    }
  }

  console.log('Products, batches, cashboxes copied successfully.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
  });