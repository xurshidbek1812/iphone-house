import { prisma } from '../lib/prisma.js';
import { allocateStockFIFO } from '../utils/order.js';

const generateContractNumber = async (tx) => {
  while (true) {
    const number = String(Math.floor(10000 + Math.random() * 90000));

    const existing = await tx.contract.findUnique({
      where: { contractNumber: number }
    });

    if (!existing) return number;
  }
};

const buildContractSchedule = ({
  durationMonths,
  paymentDay,
  debtAmount
}) => {
  const duration = Number(durationMonths || 0);
  const payDay = Number(paymentDay || 1);
  const debt = Number(debtAmount || 0);

  if (duration <= 0) return [];

  const monthlyPayment = debt / duration;
  const rows = [];

  const now = new Date();

  for (let i = 1; i <= duration; i++) {
    const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
    let date = new Date(target.getFullYear(), target.getMonth(), payDay);

    if (date.getMonth() !== target.getMonth()) {
      date = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    }

    rows.push({
      monthNumber: i,
      date,
      amount: monthlyPayment,
      paid: 0,
      status: 'KUTILMOQDA'
    });
  }

  return rows;
};

export const getContracts = async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        customer: {
          include: {
            phones: true
          }
        },
        cashbox: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
            phone: true
          }
        },
        coBorrowers: {
          include: {
            customer: {
              include: {
                phones: true
              }
            }
          }
        },
        items: {
          include: {
            product: true,
            allocations: {
              include: {
                batch: true
              }
            }
          }
        },
        schedules: {
          orderBy: {
            monthNumber: 'asc'
          }
        },
        comments: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        payments: {
          orderBy: {
            paidAt: 'desc'
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    res.json(contracts);
  } catch (error) {
    console.error('Contractlarni olishda xatolik:', error);
    res.status(500).json({ error: 'Contractlarni olishda xatolik yuz berdi' });
  }
};

export const getContractById = async (req, res) => {
  try {
    const contractId = Number(req.params.id);

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        customer: {
          include: {
            phones: true
          }
        },
        cashbox: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
            phone: true
          }
        },
        coBorrowers: {
          include: {
            customer: {
              include: {
                phones: true
              }
            }
          }
        },
        items: {
          include: {
            product: true,
            allocations: {
              include: {
                batch: true
              }
            }
          }
        },
        schedules: {
          orderBy: {
            monthNumber: 'asc'
          }
        },
        comments: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        payments: {
          orderBy: {
            paidAt: 'desc'
          }
        }
      }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Shartnoma topilmadi!' });
    }

    res.json(contract);
  } catch (error) {
    console.error('Contractni olishda xatolik:', error);
    res.status(500).json({ error: 'Shartnomani olishda xatolik yuz berdi' });
  }
};

export const createContractDraft = async (req, res) => {
  try {
    const {
      customerId,
      cashboxId,
      staffId,
      durationMonths,
      prepayment,
      paymentDay,
      note,
      coBorrowers,
      items,
      discountAmount
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Asosiy mijoz tanlanmagan!' });
    }

    if (!cashboxId) {
      return res.status(400).json({ error: 'Tashkilot (kassa) tanlanmagan!' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Kamida 1 ta tovar tanlanishi kerak!' });
    }

    const createdContractId = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: Number(customerId) }
        });

        if (!customer) {
          throw new Error('Xato: Tanlangan mijoz topilmadi!');
        }

        const cashbox = await tx.cashbox.findUnique({
          where: { id: Number(cashboxId) }
        });

        if (!cashbox) {
          throw new Error('Xato: Tanlangan tashkilot (kassa) topilmadi!');
        }

        const userId = Number(staffId || req.user.id);

        const user = await tx.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          throw new Error('Xato: Tanlangan xodim topilmadi!');
        }

        let totalAmount = 0;
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

          const product = await tx.product.findUnique({
            where: { id: productId }
          });

          if (!product) {
            throw new Error(`Xato: ID ${productId} bo'lgan tovar topilmadi!`);
          }

          if (Number(product.quantity) < quantity) {
            throw new Error(`Xato: ${product.name} uchun omborda yetarli qoldiq yo'q!`);
          }

          const lineTotal = quantity * unitPrice;
          totalAmount += lineTotal;

          preparedItems.push({
            productId,
            quantity,
            unitPrice,
            totalAmount: lineTotal
          });
        }

        const discount = Number(discountAmount || 0);

        if (discount < 0) {
        throw new Error("Xato: Chegirma manfiy bo'lishi mumkin emas!");
        }

        if (discount > totalAmount) {
        throw new Error("Xato: Chegirma umumiy summadan katta bo'lishi mumkin emas!");
        }

        const discountedTotalAmount = totalAmount - discount;

        const prepaymentAmount = Number(prepayment || 0);

        if (prepaymentAmount < 0) {
        throw new Error("Xato: Boshlang'ich to'lov manfiy bo'lishi mumkin emas!");
        }

        if (prepaymentAmount > discountedTotalAmount) {
        throw new Error("Xato: Boshlang'ich to'lov yakuniy summadan katta bo'lishi mumkin emas!");
        }

        const debtAmount = discountedTotalAmount - prepaymentAmount;
        const duration = Number(durationMonths || 0);
        const day = Number(paymentDay || 1);
        const monthlyPayment = duration > 0 ? debtAmount / duration : 0;

        const contractNumber = await generateContractNumber(tx);

        const createdContract = await tx.contract.create({
          data: {
            contractNumber,
            status: 'DRAFT',
            customerId: Number(customerId),
            cashboxId: Number(cashboxId),
            userId,
            totalAmount: discountedTotalAmount,
            discountAmount: discount,
            prepayment: prepaymentAmount,
            debtAmount,
            monthlyPayment,
            durationMonths: duration,
            paymentDay: day,
            note: note || null
            }
        });

        if (preparedItems.length > 0) {
          await tx.contractItem.createMany({
            data: preparedItems.map((item) => ({
              contractId: createdContract.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.totalAmount
            }))
          });
        }

        if (Array.isArray(coBorrowers) && coBorrowers.length > 0) {
          const validCoBorrowers = [];

          for (const co of coBorrowers) {
            const coCustomerId = Number(co.customerId || co.id);

            if (!coCustomerId || coCustomerId === Number(customerId)) continue;

            const exists = await tx.customer.findUnique({
              where: { id: coCustomerId },
              select: { id: true }
            });

            if (exists) {
              validCoBorrowers.push({
                contractId: createdContract.id,
                customerId: coCustomerId
              });
            }
          }

          if (validCoBorrowers.length > 0) {
            await tx.contractCoBorrower.createMany({
              data: validCoBorrowers
            });
          }
        }

        const scheduleRows = buildContractSchedule({
          durationMonths: duration,
          paymentDay: day,
          debtAmount
        });

        if (scheduleRows.length > 0) {
          await tx.contractSchedule.createMany({
            data: scheduleRows.map((row) => ({
              contractId: createdContract.id,
              monthNumber: row.monthNumber,
              date: row.date,
              amount: row.amount,
              paid: row.paid,
              status: row.status
            }))
          });
        }

        return createdContract.id;
      },
      {
        maxWait: 10000,
        timeout: 20000
      }
    );

    const contract = await prisma.contract.findUnique({
      where: { id: createdContractId },
      include: {
        customer: {
          include: {
            phones: true
          }
        },
        cashbox: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
            phone: true
          }
        },
        coBorrowers: {
          include: {
            customer: {
              include: {
                phones: true
              }
            }
          }
        },
        items: {
          include: {
            product: true
          }
        },
        schedules: {
          orderBy: {
            monthNumber: 'asc'
          }
        },
        comments: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        payments: {
          orderBy: {
            paidAt: 'desc'
          }
        }
      }
    });

    res.json({
      success: true,
      message: "Shartnoma jarayonda holatida saqlandi!",
      contract
    });
  } catch (error) {
    console.error('Create contract xatosi:', error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Shartnomani yaratishda xatolik yuz berdi',
      details: error.message
    });
  }
};

export const updateContractDraft = async (req, res) => {
  try {
    const contractId = Number(req.params.id);
    const {
        customerId,
        cashboxId,
        staffId,
        durationMonths,
        prepayment,
        paymentDay,
        note,
        coBorrowers,
        items,
        discountAmount
        } = req.body;

    const existing = await prisma.contract.findUnique({
      where: { id: contractId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Shartnoma topilmadi!' });
    }

    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: "Faqat jarayondagi shartnomani tahrirlash mumkin!" });
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Asosiy mijoz tanlanmagan!' });
    }

    if (!cashboxId) {
      return res.status(400).json({ error: 'Tashkilot (kassa) tanlanmagan!' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Kamida 1 ta tovar tanlanishi kerak!' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: Number(customerId) }
      });

      if (!customer) {
        throw new Error('Xato: Tanlangan mijoz topilmadi!');
      }

      const cashbox = await tx.cashbox.findUnique({
        where: { id: Number(cashboxId) }
      });

      if (!cashbox) {
        throw new Error('Xato: Tanlangan tashkilot (kassa) topilmadi!');
      }

      const userId = Number(staffId || existing.userId);

      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('Xato: Tanlangan xodim topilmadi!');
      }

      let totalAmount = 0;
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

        const product = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          throw new Error(`Xato: ID ${productId} bo'lgan tovar topilmadi!`);
        }

        if (Number(product.quantity) < quantity) {
          throw new Error(`Xato: ${product.name} uchun omborda yetarli qoldiq yo'q!`);
        }

        const lineTotal = quantity * unitPrice;
        totalAmount += lineTotal;

        preparedItems.push({
          productId,
          quantity,
          unitPrice,
          totalAmount: lineTotal
        });
      }

      const discount = Number(discountAmount || 0);

        if (discount < 0) {
            throw new Error("Xato: Chegirma manfiy bo'lishi mumkin emas!");
        }

        if (discount > totalAmount) {
            throw new Error("Xato: Chegirma umumiy summadan katta bo'lishi mumkin emas!");
        }

        const discountedTotalAmount = totalAmount - discount;

      const prepaymentAmount = Number(prepayment || 0);

        if (prepaymentAmount < 0) {
        throw new Error("Xato: Boshlang'ich to'lov manfiy bo'lishi mumkin emas!");
        }

        if (prepaymentAmount > discountedTotalAmount) {
        throw new Error("Xato: Boshlang'ich to'lov yakuniy summadan katta bo'lishi mumkin emas!");
        }

        const debtAmount = discountedTotalAmount - prepaymentAmount;
        const duration = Number(durationMonths || 0);
        const day = Number(paymentDay || 1);
        const monthlyPayment = duration > 0 ? debtAmount / duration : 0;

      await tx.contract.update({
        where: { id: contractId },
        data: {
            customerId: Number(customerId),
            cashboxId: Number(cashboxId),
            userId,
            totalAmount: discountedTotalAmount,
            discountAmount: discount,
            prepayment: prepaymentAmount,
            debtAmount,
            monthlyPayment,
            durationMonths: duration,
            paymentDay: day,
            note: note || null
            }
      });

      await tx.contractItem.deleteMany({
        where: { contractId }
      });

      for (const item of preparedItems) {
        await tx.contractItem.create({
          data: {
            contractId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount
          }
        });
      }

      await tx.contractCoBorrower.deleteMany({
        where: { contractId }
      });

      if (Array.isArray(coBorrowers) && coBorrowers.length > 0) {
        for (const co of coBorrowers) {
          const coCustomerId = Number(co.customerId || co.id);

          if (!coCustomerId || coCustomerId === Number(customerId)) continue;

          const exists = await tx.customer.findUnique({
            where: { id: coCustomerId }
          });

          if (!exists) continue;

          await tx.contractCoBorrower.create({
            data: {
              contractId,
              customerId: coCustomerId
            }
          });
        }
      }

      await tx.contractSchedule.deleteMany({
        where: { contractId }
      });

      const scheduleRows = buildContractSchedule({
        durationMonths: duration,
        paymentDay: day,
        debtAmount
      });

      if (scheduleRows.length > 0) {
        await tx.contractSchedule.createMany({
          data: scheduleRows.map((row) => ({
            contractId,
            monthNumber: row.monthNumber,
            date: row.date,
            amount: row.amount,
            paid: row.paid,
            status: row.status
          }))
        });
      }

      return true;
    });

    res.json({
      success: true,
      message: "Shartnoma muvaffaqiyatli tahrirlandi!",
      result
    });
  } catch (error) {
    console.error('Update contract xatosi:', error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Shartnomani tahrirlashda xatolik yuz berdi' });
  }
};

export const confirmContract = async (req, res) => {
  try {
    const contractId = Number(req.params.id);

    const result = await prisma.$transaction(
      async (tx) => {
        const contract = await tx.contract.findUnique({
          where: { id: contractId },
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        });

        if (!contract) {
          throw new Error('Xato: Shartnoma topilmadi!');
        }

        if (contract.status !== 'DRAFT') {
          throw new Error("Xato: Faqat jarayondagi shartnomani tasdiqlash mumkin!");
        }

        if (!contract.items || contract.items.length === 0) {
          throw new Error("Xato: Shartnomada tovarlar yo'q!");
        }

        for (const item of contract.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId }
          });

          if (!product) {
            throw new Error(`Xato: ID ${item.productId} bo'lgan tovar topilmadi!`);
          }

          if (Number(product.quantity) < Number(item.quantity)) {
            throw new Error(`Xato: ${product.name} uchun omborda yetarli qoldiq yo'q!`);
          }
        }

        for (const item of contract.items) {
          const { allocations } = await allocateStockFIFO(
            tx,
            item.productId,
            Number(item.quantity)
          );

          for (const allocation of allocations) {
            await tx.contractItemBatchAllocation.create({
              data: {
                contractItemId: item.id,
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
                sourceType: 'CONTRACT',
                sourceId: contract.id,
                note: `Contract ${contract.contractNumber} tasdiqlandi va tovar ombordan tushdi`,
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

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: 'PAYMENT_PENDING',
            confirmedAt: new Date()
          }
        });

        return true;
      },
      {
        maxWait: 10000,
        timeout: 20000
      }
    );

    res.json({
      success: true,
      message: "Shartnoma tasdiqlandi va to'lov kutilmoqda holatiga o'tdi!",
      result
    });
  } catch (error) {
    console.error('Confirm contract xatosi:', error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Shartnomani tasdiqlashda xatolik yuz berdi' });
  }
};

export const deleteContract = async (req, res) => {
  try {
    const contractId = Number(req.params.id);

    const result = await prisma.$transaction(
      async (tx) => {
        const contract = await tx.contract.findUnique({
          where: { id: contractId },
          include: {
            items: {
              include: {
                allocations: true
              }
            },
            payments: true
          }
        });

        if (!contract) {
          throw new Error('Xato: Shartnoma topilmadi!');
        }

        if (contract.status === 'COMPLETED') {
          for (const item of contract.items) {
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

          for (const payment of contract.payments) {
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
            where: {
              sourceType: 'CONTRACT_PAYMENT',
              sourceId: contractId
            }
          });

          await tx.payment.deleteMany({
            where: {
              contractId
            }
          });

          await tx.stockMovement.deleteMany({
            where: {
              sourceType: 'CONTRACT',
              sourceId: contractId
            }
          });

          const contractItemIds = contract.items.map((item) => item.id);

          if (contractItemIds.length > 0) {
            await tx.contractItemBatchAllocation.deleteMany({
              where: {
                contractItemId: { in: contractItemIds }
              }
            });
          }
        }

        await tx.contractComment.deleteMany({
          where: { contractId }
        });

        await tx.contractSchedule.deleteMany({
          where: { contractId }
        });

        await tx.contractCoBorrower.deleteMany({
          where: { contractId }
        });

        await tx.contractItem.deleteMany({
          where: { contractId }
        });

        await tx.contract.delete({
          where: { id: contractId }
        });

        return true;
      },
      {
        maxWait: 10000,
        timeout: 20000
      }
    );

    res.json({
      success: true,
      message: "Shartnoma muvaffaqiyatli o'chirildi!",
      result
    });
  } catch (error) {
    console.error('Delete contract xatosi:', error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Shartnomani o'chirishda xatolik yuz berdi" });
  }
};

export const addContractComment = async (req, res) => {
  try {
    const contractId = Number(req.params.id);
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Izoh matni bo'sh bo'lishi mumkin emas!" });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Shartnoma topilmadi!' });
    }

    const comment = await prisma.contractComment.create({
      data: {
        contractId,
        userId: req.user.id,
        authorName: req.user.fullName || req.user.username || 'Noma’lum foydalanuvchi',
        text: text.trim()
      }
    });

    res.json({
      success: true,
      message: "Izoh qo'shildi!",
      comment
    });
  } catch (error) {
    console.error('Add contract comment xatosi:', error);
    res.status(500).json({ error: "Izoh qo'shishda xatolik yuz berdi" });
  }
};

export const collectContractPayment = async (req, res) => {
  try {
    const contractId = Number(req.params.id);
    const { amount, note } = req.body;

    const paymentAmount = Number(amount);

    if (isNaN(contractId) || contractId <= 0) {
      return res.status(400).json({ error: "Shartnoma ID noto'g'ri!" });
    }

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "To'lov summasi noto'g'ri!" });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const contract = await tx.contract.findUnique({
          where: { id: contractId },
          include: {
            cashbox: true,
            items: {
              include: {
                product: true,
                allocations: true
              }
            },
            payments: {
              where: {
                status: 'POSTED',
                direction: 'IN'
              },
              orderBy: {
                paidAt: 'asc'
              }
            },
            schedules: {
              orderBy: {
                monthNumber: 'asc'
              }
            }
          }
        });

        if (!contract) {
          throw new Error("Xato: Shartnoma topilmadi!");
        }

        if (contract.status !== 'PAYMENT_PENDING') {
          throw new Error("Xato: Faqat to'lov kutilayotgan shartnomaga to'lov olish mumkin!");
        }

        if (!contract.cashboxId) {
          throw new Error("Xato: Shartnomaga kassa biriktirilmagan!");
        }

        const cashbox = await tx.cashbox.findUnique({
          where: { id: contract.cashboxId }
        });

        if (!cashbox) {
          throw new Error("Xato: Shartnomadagi kassa topilmadi!");
        }

        const totalContractAmount = Number(contract.totalAmount || 0);
        const alreadyPaid = contract.payments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        );

        const remainingDebt = Math.max(
          0,
          Number((totalContractAmount - alreadyPaid).toFixed(2))
        );

        if (remainingDebt <= 0) {
          throw new Error("Xato: Ushbu shartnoma bo'yicha qarz qolmagan!");
        }

        if (paymentAmount > remainingDebt) {
          throw new Error("Xato: To'lov summasi qolgan qarzdan katta bo'lishi mumkin emas!");
        }

        const payment = await tx.payment.create({
          data: {
            contractId: contract.id,
            amount: paymentAmount,
            currency: 'UZS',
            method: 'CONTRACT_PAYMENT',
            payerType: 'CUSTOMER',
            direction: 'IN',
            status: 'POSTED',
            paidAt: new Date(),
            cashboxId: contract.cashboxId,
            userId: req.user.id,
            note: note?.trim() || `Shartnoma ${contract.contractNumber} bo'yicha to'lov`
          }
        });

        await tx.cashTransaction.create({
          data: {
            cashboxId: contract.cashboxId,
            paymentId: payment.id,
            type: 'INCOME',
            sourceType: 'CONTRACT_PAYMENT',
            sourceId: contract.id,
            amount: paymentAmount,
            currency: 'UZS',
            note: note?.trim() || `Shartnoma ${contract.contractNumber} bo'yicha to'lov`,
            userId: req.user.id,
          }
        });

        await tx.cashbox.update({
          where: { id: contract.cashboxId },
          data: {
            balance: {
              increment: paymentAmount
            }
          }
        });

        let amountLeft = paymentAmount;

        for (const schedule of contract.schedules) {
          if (amountLeft <= 0) break;

          const scheduleAmount = Number(schedule.amount || 0);
          const schedulePaid = Number(schedule.paid || 0);
          const scheduleRemaining = Math.max(0, scheduleAmount - schedulePaid);

          if (scheduleRemaining <= 0) continue;

          const payForThisRow = Math.min(scheduleRemaining, amountLeft);

          let newPaid = schedulePaid + payForThisRow;

          // floating point xatoni yo'qotish
          if (Math.abs(scheduleAmount - newPaid) < 0.01) {
            newPaid = scheduleAmount;
          }

          let newRowStatus = 'KUTILMOQDA';
          if (newPaid >= scheduleAmount || Math.abs(scheduleAmount - newPaid) < 0.01) {
            newRowStatus = 'TOLANDI';
          } else if (newPaid > 0) {
            newRowStatus = 'QISMAN_TOLANDI';
          }

          await tx.contractSchedule.update({
            where: { id: schedule.id },
            data: {
              paid: newPaid,
              status: newRowStatus
            }
          });

          amountLeft -= payForThisRow;
        }

        const newTotalPaid = Number((alreadyPaid + paymentAmount).toFixed(2));
        const newRemainingDebt = Math.max(
          0,
          Number((totalContractAmount - newTotalPaid).toFixed(2))
        );

        const newStatus = newRemainingDebt <= 0 ? 'COMPLETED' : 'PAYMENT_PENDING';

        if (newRemainingDebt <= 0) {
          for (const item of contract.items) {
            if (!item.allocations || item.allocations.length === 0) {
              const { allocations } = await allocateStockFIFO(
                tx,
                item.productId,
                Number(item.quantity)
              );

              for (const allocation of allocations) {
                await tx.contractItemBatchAllocation.create({
                  data: {
                    contractItemId: item.id,
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
                    sourceType: 'CONTRACT',
                    sourceId: contract.id,
                    note: `Contract ${contract.contractNumber} to'liq to'langandan keyin ombordan chiqarildi`,
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
          }
        }

        const refreshedSchedules = await tx.contractSchedule.findMany({
          where: { contractId: contract.id },
          orderBy: { monthNumber: 'asc' }
        });

        const unpaidSchedules = refreshedSchedules.filter(
          (row) => Number(row.paid || 0) < Number(row.amount || 0)
        );

        const newMonthlyPayment =
          unpaidSchedules.length > 0
            ? Number((newRemainingDebt / unpaidSchedules.length).toFixed(2))
            : 0;

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            debtAmount: newRemainingDebt,
            monthlyPayment: newMonthlyPayment,
            status: newStatus
          }
        });

        const updatedContract = await tx.contract.findUnique({
          where: { id: contract.id },
          include: {
            customer: {
              include: {
                phones: true
              }
            },
            cashbox: true,
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                role: true,
                phone: true
              }
            },
            coBorrowers: {
              include: {
                customer: {
                  include: {
                    phones: true
                  }
                }
              }
            },
            items: {
              include: {
                product: true,
                allocations: {
                  include: {
                    batch: true
                  }
                }
              }
            },
            schedules: {
              orderBy: {
                monthNumber: 'asc'
              }
            },
            comments: {
              orderBy: {
                createdAt: 'desc'
              }
            },
            payments: {
              orderBy: {
                paidAt: 'desc'
              }
            }
          }
        });

        return {
          payment,
          contract: updatedContract,
          remainingDebt: newRemainingDebt,
          status: newStatus
        };
      },
      {
        maxWait: 10000,
        timeout: 20000
      }
    );

    return res.json({
      success: true,
      message:
        result.status === 'COMPLETED'
          ? "To'lov muvaffaqiyatli qabul qilindi va shartnoma yopildi!"
          : "To'lov muvaffaqiyatli qabul qilindi!",
      result
    });
  } catch (error) {
    console.error('Collect contract payment xatosi:', error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: "Shartnoma to'lovini qabul qilishda xatolik yuz berdi"
    });
  }
};
