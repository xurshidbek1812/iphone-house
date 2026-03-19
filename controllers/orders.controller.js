import { prisma } from '../lib/prisma.js';
import { generateOrderNumber, allocateStockFIFO } from '../utils/order.js';

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
    console.error('Orderlarni olishda xatolik:', error);
    res.status(500).json({ error: 'Orderlarni olishda xatolik yuz berdi' });
  }
};

export const createDirectOrder = async (req, res) => {
  try {
    const {
      customerId,
      otherName,
      otherPhone,
      note,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Savdo uchun tovarlar kiritilmadi!" });
    }

    const order = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalDiscount = 0;
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

        if (!Number.isInteger(quantity)) {
          throw new Error("Xato: Tovar soni butun son bo'lishi shart!");
        }

        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error("Xato: Tovar narxi noto'g'ri!");
        }

        const product = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          throw new Error(`Xato: ID ${productId} bo'lgan tovar topilmadi!`);
        }

        const lineSubtotal = quantity * unitPrice;
        const lineDiscount = Number(item.discountAmount || 0);

        if (isNaN(lineDiscount) || lineDiscount < 0) {
          throw new Error(`Xato: ${product.name} uchun chegirma noto'g'ri!`);
        }

        if (lineDiscount > lineSubtotal) {
          throw new Error(
            `Xato: ${product.name} uchun chegirma tovar summasidan katta bo'lishi mumkin emas!`
          );
        }

        const lineTotal = lineSubtotal - lineDiscount;

        subtotal += lineSubtotal;
        totalDiscount += lineDiscount;

        preparedItems.push({
          productId,
          quantity,
          unitPrice,
          discountAmount: lineDiscount,
          totalAmount: lineTotal
        });
      }

      const totalAmount = subtotal - totalDiscount;

      if (totalAmount < 0) {
        throw new Error("Xato: Yakuniy summa manfiy bo'lishi mumkin emas!");
      }

      const orderNumber = await generateOrderNumber(tx);

      const toUpperText = (value) => {
        if (value === null || value === undefined) return value;
        return String(value).trim().toUpperCase();
      };

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          orderType: 'DIRECT',
          status: 'DRAFT',
          customerId: customerId ? Number(customerId) : null,
          userId: req.user.id,
          subtotal,
          discountAmount: totalDiscount,
          totalAmount,
          paidAmount: 0,
          dueAmount: totalAmount,
          note: note || null,
          otherName: customerId ? null : toUpperText(otherName) || null,
          otherPhone: customerId ? null : otherPhone || null
        }
      });

      for (const preparedItem of preparedItems) {
        await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: preparedItem.productId,
            quantity: preparedItem.quantity,
            unitPrice: preparedItem.unitPrice,
            discountAmount: preparedItem.discountAmount,
            totalAmount: preparedItem.totalAmount
          }
        });
      }

      return await tx.order.findUnique({
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
              product: true
            }
          },
          payments: true
        }
      });
    });

    res.json({
      success: true,
      message: 'Savdo jarayonda holatida saqlandi!',
      order
    });
  } catch (error) {
    console.error('Create draft order xatosi:', error);

    if (error.message && error.message.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Savdoni saqlashda xatolik yuz berdi' });
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
        throw new Error('Xato: Order topilmadi!');
      }

      if (order.orderType !== 'DIRECT') {
        throw new Error("Xato: Hozircha faqat DIRECT orderni o'chirish qo'llab-quvvatlanadi!");
      }

      for (const item of order.items) {
        for (const allocation of item.allocations) {
          await tx.productBatch.update({
            where: { id: allocation.batchId },
            data: {
              quantity: { increment: Number(allocation.quantity) }
            }
          });
        }

        if (item.allocations.length > 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: Number(item.quantity) }
            }
          });
        }
      }

      for (const payment of order.payments) {
        if (payment.cashboxId && payment.direction === 'IN' && payment.status === 'POSTED') {
          await tx.cashbox.update({
            where: { id: payment.cashboxId },
            data: {
              balance: { decrement: payment.amount }
            }
          });
        }
      }

      await tx.cashTransaction.deleteMany({
        where: { sourceType: 'ORDER_PAYMENT', sourceId: orderId }
      });

      await tx.payment.deleteMany({
        where: { orderId }
      });

      await tx.stockMovement.deleteMany({
        where: { sourceType: 'ORDER', sourceId: orderId }
      });

      const orderItemIds = order.items.map((item) => item.id);

      if (orderItemIds.length > 0) {
        await tx.orderItemBatchAllocation.deleteMany({
          where: {
            orderItemId: { in: orderItemIds }
          }
        });
      }

      await tx.orderItem.deleteMany({
        where: { orderId }
      });

      await tx.order.delete({
        where: { id: orderId }
      });

      return true;
    });

    res.json({
      success: true,
      message: "Order muvaffaqiyatli o'chirildi va barcha qoldiq/kassa holati tiklandi!",
      result
    });
  } catch (error) {
    console.error('Delete order xatosi:', error);

    if (error.message && error.message.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Orderni o'chirishda xatolik yuz berdi" });
  }
};

export const updateOrderDraft = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const {
      customerId,
      otherName,
      otherPhone,
      note,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Savdo uchun tovarlar kiritilmadi!" });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true
      }
    });

    if (!existingOrder) {
      return res.status(404).json({ error: "Savdo topilmadi!" });
    }

    if (String(existingOrder.status).toUpperCase() !== 'DRAFT') {
      return res.status(400).json({
        error: "Faqat jarayondagi savdoni tahrirlash mumkin!"
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalDiscount = 0;
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

        if (!Number.isInteger(quantity)) {
          throw new Error("Xato: Tovar soni butun son bo'lishi shart!");
        }

        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error("Xato: Tovar narxi noto'g'ri!");
        }

        const product = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          throw new Error(`Xato: ID ${productId} bo'lgan tovar topilmadi!`);
        }

        const lineSubtotal = quantity * unitPrice;
        const lineDiscount = Number(item.discountAmount || 0);

        if (isNaN(lineDiscount) || lineDiscount < 0) {
          throw new Error(`Xato: ${product.name} uchun chegirma noto'g'ri!`);
        }

        if (lineDiscount > lineSubtotal) {
          throw new Error(
            `Xato: ${product.name} uchun chegirma tovar summasidan katta bo'lishi mumkin emas!`
          );
        }

        const lineTotal = lineSubtotal - lineDiscount;

        subtotal += lineSubtotal;
        totalDiscount += lineDiscount;

        preparedItems.push({
          productId,
          quantity,
          unitPrice,
          discountAmount: lineDiscount,
          totalAmount: lineTotal
        });
      }

      const totalAmount = subtotal - totalDiscount;

      if (totalAmount < 0) {
        throw new Error("Xato: Yakuniy summa manfiy bo'lishi mumkin emas!");
      }

      const toUpperText = (value) => {
        if (value === null || value === undefined) return value;
        return String(value).trim().toUpperCase();
      };

      await tx.order.update({
        where: { id: orderId },
        data: {
          customerId: customerId ? Number(customerId) : null,
          subtotal,
          discountAmount: totalDiscount,
          totalAmount,
          dueAmount: totalAmount - Number(existingOrder.paidAmount || 0),
          note: note || null,
          otherName: customerId ? null : toUpperText(otherName) || null,
          otherPhone: customerId ? null : otherPhone || null
        }
      });

      await tx.orderItem.deleteMany({
        where: { orderId }
      });

      for (const preparedItem of preparedItems) {
        await tx.orderItem.create({
          data: {
            orderId,
            productId: preparedItem.productId,
            quantity: preparedItem.quantity,
            unitPrice: preparedItem.unitPrice,
            discountAmount: preparedItem.discountAmount,
            totalAmount: preparedItem.totalAmount
          }
        });
      }

      return await tx.order.findUnique({
        where: { id: orderId },
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
              product: true
            }
          },
          payments: true
        }
      });
    });

    res.json({
      success: true,
      message: 'Savdo yangilandi!',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update draft order xatosi:', error);

    if (error.message && error.message.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Savdoni yangilashda xatolik yuz berdi' });
  }
};

export const confirmOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order topilmadi!' });
    }

    if (order.status !== 'DRAFT') {
      return res.status(400).json({ error: "Faqat jarayondagi savdoni tasdiqlash mumkin!" });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAYMENT_PENDING'
      }
    });

    res.json({
      success: true,
      message: "Savdo to'lov kutilmoqda holatiga o'tdi!"
    });
  } catch (error) {
    console.error('Confirm order xatosi:', error);
    res.status(500).json({ error: 'Savdoni tasdiqlashda xatolik yuz berdi' });
  }
};

export const collectOrderPayment = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { cashboxId, amount, note } = req.body;

    const paymentAmount = Number(amount);

    if (!cashboxId) {
      return res.status(400).json({ error: 'Kassa tanlanmagan!' });
    }

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "To'lov summasi noto'g'ri!" });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                product: true
              }
            },
            payments: true
          }
        });

        if (!order) {
          throw new Error('Xato: Order topilmadi!');
        }

        if (order.status !== 'PAYMENT_PENDING') {
          throw new Error("Xato: Faqat to'lov kutilayotgan savdolar uchun to'lov olish mumkin!");
        }

        if (Number(order.dueAmount) <= 0) {
          throw new Error("Xato: Bu savdo allaqachon to'liq yopilgan!");
        }

        if (paymentAmount > Number(order.dueAmount)) {
          throw new Error("Xato: To'lov summasi qolgan qarzdan ko'p bo'lishi mumkin emas!");
        }

        const cashbox = await tx.cashbox.findUnique({
          where: { id: Number(cashboxId) }
        });

        if (!cashbox) {
          throw new Error("Xato: Tanlangan kassa topilmadi!");
        }

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            amount: paymentAmount,
            currency: 'UZS',
            method: cashbox.name || 'CASH',
            payerType: 'CUSTOMER',
            direction: 'IN',
            status: 'POSTED',
            paidAt: new Date(),
            cashboxId: cashbox.id,
            userId: req.user.id,
            note: note || null
          }
        });

        await tx.cashTransaction.create({
          data: {
            cashboxId: cashbox.id,
            paymentId: payment.id,
            type: 'INCOME',
            sourceType: 'ORDER_PAYMENT',
            sourceId: order.id,
            amount: paymentAmount,
            currency: 'UZS',
            note: note || `Order #${order.orderNumber} uchun to'lov`,
            userId: req.user.id
          }
        });

        await tx.cashbox.update({
          where: { id: cashbox.id },
          data: {
            balance: { increment: paymentAmount }
          }
        });

        const newPaidAmount = Number(order.paidAmount) + paymentAmount;
        const newDueAmount = Number(order.totalAmount) - newPaidAmount;

        let newStatus = 'PAYMENT_PENDING';

        await tx.order.update({
          where: { id: order.id },
          data: {
            paidAmount: newPaidAmount,
            dueAmount: newDueAmount < 0 ? 0 : newDueAmount
          }
        });

        if (newDueAmount <= 0) {
          for (const item of order.items) {
            const { allocations } = await allocateStockFIFO(
              tx,
              item.productId,
              Number(item.quantity)
            );

            for (const allocation of allocations) {
              await tx.orderItemBatchAllocation.create({
                data: {
                  orderItemId: item.id,
                  batchId: allocation.batchId,
                  quantity: allocation.quantity,
                  unitCost: allocation.unitCost,
                  unitPrice: Number(item.unitPrice)
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
                  productId: item.productId,
                  batchId: allocation.batchId,
                  type: 'OUT',
                  quantity: allocation.quantity,
                  unitCost: allocation.unitCost,
                  unitPrice: Number(item.unitPrice),
                  sourceType: 'ORDER',
                  sourceId: order.id,
                  note: `Order ${order.orderNumber} to'liq to'langandan keyin ombordan chiqarildi`,
                  userId: req.user.id
                }
              });
            }

            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: { decrement: Number(item.quantity) }
              }
            });
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              dueAmount: 0
            }
          });

          newStatus = 'COMPLETED';
        }

        return {
          paymentId: payment.id,
          status: newStatus
        };
      },
      {
        maxWait: 10000,
        timeout: 20000
      }
    );

    res.json({
      success: true,
      message:
        result.status === 'COMPLETED'
          ? "To'lov muvaffaqiyatli olindi va savdo yakunlandi!"
          : "To'lov muvaffaqiyatli olindi!",
      result
    });
  } catch (error) {
    console.error('Collect order payment xatosi:', error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "To'lov olishda xatolik yuz berdi" });
  }
};