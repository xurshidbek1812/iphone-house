const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {

  const batches = await prisma.productBatch.findMany()

  console.log("Batch count:", batches.length)

  for (const batch of batches) {

    await prisma.stockMovement.create({
      data: {
        productId: batch.productId,
        batchId: batch.id,
        type: "IN",
        quantity: batch.quantity,
        sourceType: "MIGRATION",
        note: "Initial stock migration"
      }
    })

  }

  console.log("Stock movements created")

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())