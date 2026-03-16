import { prisma } from '../lib/prisma.js';

export const finishInventory = async (req, res) => {
  const { items, updateStock } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Sanoq ro'yxati bo'sh!" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const totalDiff = items.reduce((sum, item) => sum + item.diff, 0);

      const newAct = await tx.inventoryAct.create({
        data: {
          totalDiff,
          isStockUpdated: updateStock === true
        }
      });

      const updatedProductIds = new Set();

      for (const item of items) {
        await tx.inventoryItem.create({
          data: {
            inventoryActId: newAct.id,
            productId: item.id,
            systemQty: Number(item.systemQty),
            countedQty: Number(item.scannedQty),
            diff: Number(item.diff)
          }
        });

        if (updateStock === true) {
          if (item.batchId) {
            await tx.productBatch.update({
              where: { id: Number(item.batchId) },
              data: { quantity: Number(item.scannedQty) }
            });

            updatedProductIds.add(item.id);
          } else {
            await tx.product.update({
              where: { id: item.id },
              data: { quantity: Number(item.scannedQty) }
            });
          }
        }
      }

      if (updateStock === true) {
        for (const pId of updatedProductIds) {
          const aggregate = await tx.productBatch.aggregate({
            where: {
              productId: pId,
              isArchived: false
            },
            _sum: { quantity: true }
          });

          const totalQuantity = aggregate._sum.quantity || 0;

          await tx.product.update({
            where: { id: pId },
            data: { quantity: totalQuantity }
          });
        }
      }

      return newAct;
    });

    res.json({ success: true, actId: result.id });
  } catch (error) {
    console.error("Sanoq xatosi:", error);
    res.status(500).json({ error: "Sanoqni saqlashda xatolik bo'ldi" });
  }
};

export const getInventoryHistory = async (req, res) => {
  try {
    const history = await prisma.inventoryAct.findMany({
      include: {
        items: {
          include: { product: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error("Tarixni olishda xatolik:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
};