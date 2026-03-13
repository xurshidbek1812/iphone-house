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
        user: {
            select: {
                id: true,
                fullName: true,
                username: true,
                role: true,
                phone: true
            }
        },
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
        const batchId = item.batchId ? Number(item.batchId) : null;
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

        const { allocations } = await allocateStockFIFO(tx, productId, quantity, batchId);

        const lineDiscount = Number(item.discountAmount || 0);
        const lineTotal = (quantity * unitPrice) - lineDiscount;

        subtotal += lineTotal;

        preparedItems.push({
            productId,
            batchId,
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
          user: {
            select: {
                id: true,
                fullName: true,
                username: true,
                role: true,
                phone: true
            }
          },
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

export const deleteOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              allocations: true
            }
          },
          payments: true
        }
      });

      if (!order) {
        throw new Error("Xato: Order topilmadi!");
      }

      if (order.orderType !== "DIRECT") {
        throw new Error("Xato: Hozircha faqat DIRECT orderni o'chirish qo'llab-quvvatlanadi!");
      }

      // 1) Batch va product qoldig'ini qaytarish
      for (const item of order.items) {
        for (const allocation of item.allocations) {
          await tx.productBatch.update({
            where: { id: allocation.batchId },
            data: {
              quantity: { increment: Number(allocation.quantity) }
            }
          });
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { increment: Number(item.quantity) }
          }
        });
      }

      // 2) Kassadan pulni ayirish
      for (const payment of order.payments) {
        if (payment.cashboxId && payment.direction === "IN" && payment.status === "POSTED") {
          await tx.cashbox.update({
            where: { id: payment.cashboxId },
            data: {
              balance: { decrement: payment.amount }
            }
          });
        }
      }

      // 3) CashTransactionlarni o'chirish
      await tx.cashTransaction.deleteMany({
        where: { sourceType: "ORDER_PAYMENT", sourceId: orderId }
      });

      // 4) Paymentlarni o'chirish
      await tx.payment.deleteMany({
        where: { orderId: orderId }
      });

      // 5) StockMovementlarni o'chirish
      await tx.stockMovement.deleteMany({
        where: { sourceType: "ORDER", sourceId: orderId }
      });

      // 6) Allocationlarni o'chirish
      const orderItemIds = order.items.map((item) => item.id);

      if (orderItemIds.length > 0) {
        await tx.orderItemBatchAllocation.deleteMany({
          where: {
            orderItemId: { in: orderItemIds }
          }
        });
      }

      // 7) Order itemlarni o'chirish
      await tx.orderItem.deleteMany({
        where: { orderId: orderId }
      });

      // 8) Orderni o'chirish
      await tx.order.delete({
        where: { id: orderId }
      });

      return true;
    });

    res.json({
      success: true,
      message: "Order muvaffaqiyatli o'chirildi va barcha qoldiq/kassa holati tiklandi!"
    });
  } catch (error) {
    console.error("Delete order xatosi:", error);

    if (error.message && error.message.startsWith("Xato:")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Orderni o'chirishda xatolik yuz berdi" });
  }
};