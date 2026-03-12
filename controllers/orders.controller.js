import { prisma } from '../lib/prisma.js';
import {
  allocateStockFIFO,
  generateOrderNumber,
  getMainCashbox
} from '../utils/order.js';

export const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: true,
        partner: true,
        user: true,
        items: {
          include: {
            product: true,
            allocations: {
              include: { batch: true }
            }
          }
        },
        payments: true
      },
      orderBy: { id: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error("Orderlarni olishda xatolik:", error);
    res.status(500).json({ error: "Orderlarni olishda xatolik yuz berdi" });
  }
};

export const createDirectOrder = async (req, res) => {
  try {
    const {
      customerId,
      cashboxId,
      paymentMethod,
      note,
      discountAmount,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Savdo uchun tovarlar kiritilmadi!" });
    }

    const order = await prisma.$transaction(async (tx) => {
      const mainCashbox = await getMainCashbox(tx, cashboxId);

      let subtotal = 0;
      const preparedItems = [];

      for (const item of items) {
        const productId = Number(item.productId || item.id);
        const quantity = Number(item.quantity || item.qty);
        const unitPrice = Number(item.unitPrice || item.salePrice || item.price);

        if (isNaN(productId) || productId <= 0) {
          throw new Error("Xato: Tovar ID noto'g'ri!");
        }

        if (isNaN(quantity) || quantity <= 0) {
          throw new Error("Xato: Tovar soni 0 dan katta bo'lishi shart!");
        }

        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error("Xato: Tovar narxi noto'g'ri!");
        }

        const { allocations } = await allocateStockFIFO(tx, productId, quantity);

        const lineDiscount = Number(item.discountAmount || 0);
        const lineTotal = (quantity * unitPrice) - lineDiscount;

        subtotal += lineTotal;

        preparedItems.push({
          productId,
          quantity,
          unitPrice,
          discountAmount: lineDiscount,
          totalAmount: lineTotal,
          allocations
        });
      }

      const totalDiscount = Number(discountAmount || 0);
      const totalAmount = subtotal - totalDiscount;

      if (totalAmount < 0) {
        throw new Error("Xato: Yakuniy summa manfiy bo'lishi mumkin emas!");
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          orderType: "DIRECT",
          status: "COMPLETED",
          customerId: customerId ? Number(customerId) : null,
          userId: req.user.id,
          subtotal,
          discountAmount: totalDiscount,
          totalAmount,
          paidAmount: totalAmount,
          dueAmount: 0,
          note: note || null
        }
      });

      for (const preparedItem of preparedItems) {
        const createdItem = await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: preparedItem.productId,
            quantity: preparedItem.quantity,
            unitPrice: preparedItem.unitPrice,
            discountAmount: preparedItem.discountAmount,
            totalAmount: preparedItem.totalAmount
          }
        });

        for (const allocation of preparedItem.allocations) {
          await tx.orderItemBatchAllocation.create({
            data: {
              orderItemId: createdItem.id,
              batchId: allocation.batchId,
              quantity: allocation.quantity,
              unitCost: allocation.unitCost,
              unitPrice: preparedItem.unitPrice
            }
          });

          await tx.productBatch.update({
            where: { id: allocation.batchId },
            data: {
              quantity: { decrement: allocation.quantity }
            }
          });

          await tx.stockMovement.create({
            data: {
              productId: preparedItem.productId,
              batchId: allocation.batchId,
              type: "OUT",
              quantity: allocation.quantity,
              unitCost: allocation.unitCost,
              unitPrice: preparedItem.unitPrice,
              sourceType: "ORDER",
              sourceId: createdOrder.id,
              note: `Direct order ${createdOrder.orderNumber}`,
              userId: req.user.id
            }
          });
        }

        await tx.product.update({
          where: { id: preparedItem.productId },
          data: {
            quantity: { decrement: preparedItem.quantity }
          }
        });
      }

      const payment = await tx.payment.create({
        data: {
          orderId: createdOrder.id,
          amount: totalAmount,
          currency: "UZS",
          method: paymentMethod || "CASH",
          payerType: "CUSTOMER",
          direction: "IN",
          status: "POSTED",
          paidAt: new Date(),
          cashboxId: mainCashbox.id,
          userId: req.user.id,
          note: note || null
        }
      });

      await tx.cashTransaction.create({
        data: {
          cashboxId: mainCashbox.id,
          paymentId: payment.id,
          type: "INCOME",
          sourceType: "ORDER_PAYMENT",
          sourceId: createdOrder.id,
          amount: totalAmount,
          currency: "UZS",
          note: `Direct order payment ${createdOrder.orderNumber}`,
          userId: req.user.id
        }
      });

      await tx.cashbox.update({
        where: { id: mainCashbox.id },
        data: {
          balance: { increment: totalAmount }
        }
      });

      return tx.order.findUnique({
        where: { id: createdOrder.id },
        include: {
          customer: true,
          user: true,
          items: {
            include: {
              product: true,
              allocations: {
                include: { batch: true }
              }
            }
          },
          payments: true
        }
      });
    });

    res.json({
      success: true,
      message: "Yangi savdo muvaffaqiyatli yaratildi!",
      order
    });
  } catch (error) {
    console.error("Direct order xatosi:", error);

    if (error.message && error.message.startsWith("Xato:")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Yangi savdoni yaratishda xatolik yuz berdi" });
  }
};