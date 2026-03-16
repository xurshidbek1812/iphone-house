import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '../utils/permissions.js';
import { randomUUID } from 'crypto';

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

export const getCashboxes = async (req, res) => {
  try {
    const cashboxes = await prisma.cashbox.findMany({
      orderBy: { id: 'desc' }
    });

    res.json(cashboxes);
  } catch (error) {
    console.error("Cashboxlarni olishda xatolik:", error);
    res.status(500).json({
      error: "Kassa ma'lumotlarini yuklashda xatolik"
    });
  }
};

export const createCashbox = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CASHBOX_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kassalarni boshqarish huquqi yo'q!"
    });
  }

  try {
    const { name, currency, responsibleName, isActive } = req.body;

    if (!name || !currency) {
      return res.status(400).json({
        error: "Kassa nomi va valyuta kiritilishi shart!"
      });
    }

    const newCashbox = await prisma.cashbox.create({
      data: {
        name: String(name).trim(),
        currency: String(currency).trim().toUpperCase(),
        responsibleName: responsibleName ? String(responsibleName).trim() : null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        balance: 0
      }
    });

    res.json(newCashbox);
  } catch (error) {
    console.error("Kassa yaratishda xatolik:", error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        error: "Bu nomdagi kassa allaqachon mavjud!"
      });
    }

    res.status(500).json({
      error: "Kassa yaratishda xatolik yuz berdi"
    });
  }
};

export const updateCashbox = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CASHBOX_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kassalarni boshqarish huquqi yo'q!"
    });
  }

  try {
    const cashboxId = Number(req.params.id);
    const { name, currency, responsibleName, isActive } = req.body;

    const existingCashbox = await prisma.cashbox.findUnique({
      where: { id: cashboxId }
    });

    if (!existingCashbox) {
      return res.status(404).json({
        error: "Kassa topilmadi!"
      });
    }

    const nextCurrency = currency
      ? String(currency).trim().toUpperCase()
      : existingCashbox.currency;

    if (
      Number(existingCashbox.balance || 0) > 0 &&
      nextCurrency !== existingCashbox.currency
    ) {
      return res.status(400).json({
        error: "Balansida mablag' bor kassaning valyutasini o'zgartirib bo'lmaydi!"
      });
    }

    const updatedCashbox = await prisma.cashbox.update({
      where: { id: cashboxId },
      data: {
        name: name ? String(name).trim() : existingCashbox.name,
        currency: currency
          ? String(currency).trim().toUpperCase()
          : existingCashbox.currency,
        responsibleName:
          responsibleName !== undefined
            ? (responsibleName ? String(responsibleName).trim() : null)
            : existingCashbox.responsibleName,
        isActive:
          typeof isActive === 'boolean'
            ? isActive
            : existingCashbox.isActive
      }
    });

    res.json(updatedCashbox);
  } catch (error) {
    console.error("Kassani yangilashda xatolik:", error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        error: "Bu nomdagi kassa allaqachon mavjud!"
      });
    }

    res.status(500).json({
      error: "Kassani yangilashda xatolik yuz berdi"
    });
  }
};

export const deleteCashbox = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CASHBOX_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kassalarni boshqarish huquqi yo'q!"
    });
  }

  try {
    const cashboxId = Number(req.params.id);

    const existingCashbox = await prisma.cashbox.findUnique({
      where: { id: cashboxId }
    });

    if (!existingCashbox) {
      return res.status(404).json({
        error: "Kassa topilmadi!"
      });
    }

    if (Number(existingCashbox.balance || 0) > 0) {
      return res.status(400).json({
        error: "Balansida mablag' bor kassani o'chirib bo'lmaydi. Uni faolsizlantiring."
      });
    }

    await prisma.cashbox.delete({
      where: { id: cashboxId }
    });

    res.json({
      success: true,
      message: "Kassa o'chirildi"
    });
  } catch (error) {
    console.error('deleteCashbox xatosi:', error);
    res.status(500).json({
      error: "Kassani o'chirishda xatolik yuz berdi"
    });
  }
};

export const updateCashboxStatus = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CASHBOX_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kassalarni boshqarish huquqi yo'q!"
    });
  }

  try {
    const cashboxId = Number(req.params.id);
    const { isActive } = req.body;

    const cashbox = await prisma.cashbox.findUnique({
      where: { id: cashboxId }
    });

    if (!cashbox) {
      return res.status(404).json({
        error: "Kassa topilmadi!"
      });
    }

    const updatedCashbox = await prisma.cashbox.update({
      where: { id: cashboxId },
      data: {
        isActive: Boolean(isActive)
      }
    });

    res.json(updatedCashbox);
  } catch (error) {
    console.error("Kassa holatini o'zgartirishda xatolik:", error);
    res.status(500).json({
      error: "Kassa holatini o'zgartirishda xatolik yuz berdi"
    });
  }
};

export const depositCashbox = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CASHBOX_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kassalarni boshqarish huquqi yo'q!"
    });
  }

  try {
    const cashboxId = Number(req.params.id);
    const { amount, note } = req.body;

    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Kirim summasi 0 dan katta bo'lishi kerak!"
      });
    }

    const cashbox = await prisma.cashbox.findUnique({
      where: { id: cashboxId }
    });

    if (!cashbox) {
      return res.status(404).json({
        error: "Kassa topilmadi!"
      });
    }

    if (!cashbox.isActive) {
      return res.status(400).json({
        error: "Yopilgan kassaga kirim qilib bo'lmaydi!"
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedCashbox = await tx.cashbox.update({
        where: { id: cashboxId },
        data: {
          balance: {
            increment: new Prisma.Decimal(parsedAmount)
          }
        }
      });

      await tx.cashboxTransaction.create({
        data: {
          cashboxId,
          type: 'DEPOSIT',
          amount: new Prisma.Decimal(parsedAmount),
          note: note ? String(note).trim() : null,
          userId: req.user.id
        }
      });

      return updatedCashbox;
    });

    res.json(result);
  } catch (error) {
    console.error("depositCashbox xatosi:", error);
    res.status(500).json({
      error: "Kassaga kirim qilishda xatolik yuz berdi"
    });
  }
};

export const withdrawCashbox = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CASHBOX_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kassalarni boshqarish huquqi yo'q!"
    });
  }

  try {
    const cashboxId = Number(req.params.id);
    const { amount, note } = req.body;

    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Chiqim summasi 0 dan katta bo'lishi kerak!"
      });
    }

    const cashbox = await prisma.cashbox.findUnique({
      where: { id: cashboxId }
    });

    if (!cashbox) {
      return res.status(404).json({
        error: "Kassa topilmadi!"
      });
    }

    if (!cashbox.isActive) {
      return res.status(400).json({
        error: "Yopilgan kassadan chiqim qilib bo'lmaydi!"
      });
    }

    if (Number(cashbox.balance) < parsedAmount) {
      return res.status(400).json({
        error: "Kassada yetarli mablag' yo'q!"
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedCashbox = await tx.cashbox.update({
        where: { id: cashboxId },
        data: {
          balance: {
            decrement: new Prisma.Decimal(parsedAmount)
          }
        }
      });

      await tx.cashboxTransaction.create({
        data: {
          cashboxId,
          type: 'WITHDRAW',
          amount: new Prisma.Decimal(parsedAmount),
          note: note ? String(note).trim() : null,
          userId: req.user.id
        }
      });

      return updatedCashbox;
    });

    res.json(result);
  } catch (error) {
    console.error("withdrawCashbox xatosi:", error);
    res.status(500).json({
      error: "Kassadan chiqim qilishda xatolik yuz berdi"
    });
  }
};

export const getCashboxTransactions = async (req, res) => {
  try {
    const cashboxId = Number(req.params.id);

    const transactions = await prisma.cashboxTransaction.findMany({
      where: { cashboxId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(transactions);
  } catch (error) {
    console.error("getCashboxTransactions xatosi:", error);
    res.status(500).json({
      error: "Kassa tarixini yuklashda xatolik yuz berdi"
    });
  }
};

export const transferBetweenCashboxes = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CASHBOX_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kassalarni boshqarish huquqi yo'q!"
    });
  }

  try {
    const { fromCashboxId, toCashboxId, amount, note } = req.body;

    const fromId = Number(fromCashboxId);
    const toId = Number(toCashboxId);
    const parsedAmount = Number(amount);

    if (!fromId || !toId) {
      return res.status(400).json({
        error: "Qaysi kassadan va qaysi kassaga o'tkazilishi tanlanishi shart!"
      });
    }

    if (fromId === toId) {
      return res.status(400).json({
        error: "Bir xil kassa orasida o'tkazma qilib bo'lmaydi!"
      });
    }

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Summa 0 dan katta bo'lishi kerak!"
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transferGroupId = randomUUID();
      const fromCashbox = await tx.cashbox.findUnique({
        where: { id: fromId }
      });

      const toCashbox = await tx.cashbox.findUnique({
        where: { id: toId }
      });

      if (!fromCashbox || !toCashbox) {
        throw new Error("Kassalardan biri topilmadi!");
      }

      if (!fromCashbox.isActive || !toCashbox.isActive) {
        throw new Error("Yopilgan kassa bilan o'tkazma qilib bo'lmaydi!");
      }

      if (fromCashbox.currency !== toCashbox.currency) {
        throw new Error("Turli valyutadagi kassalar orasida to'g'ridan-to'g'ri o'tkazma qilib bo'lmaydi!");
      }

      if (Number(fromCashbox.balance) < parsedAmount) {
        throw new Error("Manba kassada yetarli mablag' yo'q!");
      }

      await tx.cashbox.update({
        where: { id: fromId },
        data: {
          balance: {
            decrement: new Prisma.Decimal(parsedAmount)
          }
        }
      });

      await tx.cashbox.update({
        where: { id: toId },
        data: {
          balance: {
            increment: new Prisma.Decimal(parsedAmount)
          }
        }
      });

      await tx.cashboxTransaction.create({
        data: {
          cashboxId: fromId,
          type: 'TRANSFER_OUT',
          amount: new Prisma.Decimal(parsedAmount),
          note: note
            ? String(note).trim()
            : `${toCashbox.name} kassasiga o'tkazma`,
          userId: req.user.id,
          transferGroupId
        }
      });

      await tx.cashboxTransaction.create({
        data: {
          cashboxId: toId,
          type: 'TRANSFER_IN',
          amount: new Prisma.Decimal(parsedAmount),
          note: note
            ? String(note).trim()
            : `${fromCashbox.name} kassasidan o'tkazma`,
          userId: req.user.id,
          transferGroupId
        }
      });

      return { success: true };
    });

    res.json({
      success: true,
      message: "Kassalar orasida o'tkazma muvaffaqiyatli bajarildi!"
    });
  } catch (error) {
    console.error("transferBetweenCashboxes xatosi:", error);

    const safeMessage =
      error?.message || "Kassalar orasida o'tkazma qilishda xatolik yuz berdi";

    res.status(500).json({
      error: safeMessage
    });
  }
};

export const getAllCashboxTransactions = async (req, res) => {
  try {
    const transactions = await prisma.cashboxTransaction.findMany({
      include: {
        cashbox: {
          select: {
            id: true,
            name: true,
            currency: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(transactions);
  } catch (error) {
    console.error('getAllCashboxTransactions xatosi:', error);
    res.status(500).json({
      error: "Kassa amaliyotlarini yuklashda xatolik yuz berdi"
    });
  }
};