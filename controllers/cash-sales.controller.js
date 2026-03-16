import { prisma } from '../lib/prisma.js';

export const getCashSales = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        user: true,
        items: true
      },
      orderBy: { id: 'desc' }
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: "Naqd savdolarni olishda xatolik" });
  }
};

export const createCashSale = async (req, res) => {
  try {
    const {
      isAnonymous,
      customerId,
      otherName,
      otherPhone,
      totalAmount,
      discount,
      finalAmount,
      note,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Savat bo'sh! Savdoga tovar kiritilmadi."
      });
    }

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          totalAmount: Number(totalAmount),
          discount: Number(discount || 0),
          finalAmount: Number(finalAmount || totalAmount),
          note: note || null,
          customerId: isAnonymous ? null : Number(customerId),
          userId: req.user.id,
          otherName: isAnonymous ? otherName : null,
          otherPhone: isAnonymous ? otherPhone : null,
          status: 'JARAYONDA'
        }
      });

      for (const item of items) {
        const qty = Number(item.qty);
        const salePrice = Number(item.salePrice);

        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Xato: ${item.name} tovarining soni noto'g'ri kiritildi!`);
        }

        if (isNaN(salePrice) || salePrice < 0) {
          throw new Error(`Xato: ${item.name} tovarining narxi noto'g'ri!`);
        }

        const currentProd = await tx.product.findUnique({
          where: { id: item.id }
        });

        if (!currentProd) {
          throw new Error(`Xato: Bazada ID: ${item.id} bo'lgan tovar topilmadi!`);
        }

        if (currentProd.quantity < qty) {
          throw new Error(`Xato: ${item.name} tovaridan omborda yetarli qoldiq yo'q!`);
        }

        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.id,
            quantity: qty,
            price: salePrice
          }
        });
      }

      return newSale;
    });

    res.json({ success: true, sale });
  } catch (error) {
    console.error("Naqd savdo xatosi:", error);

    if (error.message.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Naqd savdo saqlashda xatolik yuz berdi" });
  }
};

export const updateCashSale = async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    const { totalAmount, discount, finalAmount, note, items } = req.body;

    const existingSale = await prisma.sale.findUnique({
      where: { id: saleId }
    });

    if (!existingSale) {
      return res.status(404).json({ error: "Savdo topilmadi!" });
    }

    if (existingSale.status === 'TASDIQLANDI') {
      return res.status(400).json({
        error: "Tasdiqlangan savdoni tahrirlab bo'lmaydi!"
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: {
          totalAmount: Number(totalAmount),
          discount: Number(discount || 0),
          finalAmount: Number(finalAmount || totalAmount),
          note: note || null
        }
      });

      await tx.saleItem.deleteMany({
        where: { saleId }
      });

      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId,
            productId: item.id,
            quantity: Number(item.qty),
            price: Number(item.salePrice)
          }
        });
      }
    });

    res.json({ success: true, message: "Savdo muvaffaqiyatli tahrirlandi" });
  } catch (error) {
    res.status(500).json({ error: "Tahrirlashda xatolik" });
  }
};

export const approveCashSale = async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    const { status } = req.body;

    const targetStatus = status ? status.toUpperCase() : 'YAKUNLANGAN';

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });

    if (!sale) {
      return res.status(404).json({ error: "Savdo topilmadi!" });
    }

    if (sale.status === 'YAKUNLANGAN' || sale.status === 'TASDIQLANDI') {
      return res.status(400).json({
        error: "Bu savdo allaqachon yakunlangan!"
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: { status: targetStatus }
      });

      if (targetStatus === 'YAKUNLANGAN') {
        for (const item of sale.items) {
          const currentProd = await tx.product.findUnique({
            where: { id: item.productId }
          });

          if (!currentProd || currentProd.quantity < item.quantity) {
            throw new Error(`Xato: Omborda tovar qoldig'i yetarli emas!`);
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { decrement: item.quantity }
            }
          });
        }

        const mainCashbox = await tx.cashbox.findFirst({
          orderBy: { id: 'asc' }
        });

        if (!mainCashbox) {
          throw new Error("Xato: Tizimda kassa topilmadi! Prisma Studio orqali bitta kassa yarating.");
        }

        await tx.cashbox.update({
          where: { id: mainCashbox.id },
          data: {
            balance: { increment: sale.finalAmount }
          }
        });

        await tx.transaction.create({
          data: {
            amount: sale.finalAmount,
            type: 'INCOME',
            paymentMethod: 'NAQD',
            reason: 'Naqd Savdo',
            description: `Naqd savdo №${sale.id} bo'yicha to'lov`,
            referenceId: sale.id,
            cashboxId: mainCashbox.id,
            userId: req.user.id
          }
        });
      }
    });

    res.json({
      success: true,
      message: `Savdo ${targetStatus} holatiga o'tdi!`
    });
  } catch (error) {
    if (error.message && error.message.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Tasdiqlashda xatolik yuz berdi" });
  }
};

export const deleteCashSale = async (req, res) => {
  try {
    const saleId = Number(req.params.id);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });

    if (!sale) {
      return res.status(404).json({ error: "Savdo topilmadi!" });
    }

    await prisma.$transaction(async (tx) => {
      if (sale.status === 'YAKUNLANGAN' || sale.status === 'TASDIQLANDI') {
        const transaction = await tx.transaction.findFirst({
          where: {
            referenceId: saleId,
            reason: 'Naqd Savdo',
            type: 'INCOME'
          }
        });

        if (transaction && transaction.cashboxId) {
          await tx.cashbox.update({
            where: { id: transaction.cashboxId },
            data: {
              balance: { decrement: transaction.amount }
            }
          });

          await tx.transaction.delete({
            where: { id: transaction.id }
          });
        }
      }

      if (sale.status === 'YAKUNLANGAN' || sale.status === 'TASDIQLANDI') {
        for (const item of sale.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity }
            }
          });
        }
      }

      await tx.saleItem.deleteMany({ where: { saleId } });
      await tx.sale.delete({ where: { id: saleId } });
    });

    res.json({
      success: true,
      message: "Savdo bekor qilindi, tovarlar va pullar omborga/kassaga qaytarildi!"
    });
  } catch (error) {
    console.error("Delete Sale Error:", error);
    res.status(500).json({ error: "O'chirishda xatolik yuz berdi" });
  }
};