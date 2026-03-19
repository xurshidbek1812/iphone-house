import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

const canManageExpense = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'director') return true;

  return hasPermission(user, PERMISSIONS.EXPENSE_APPROVE);
};

export const getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        cashbox: true,
        expenseCategory: {
          include: {
            group: true
          }
        },
        createdBy: {
          select: { id: true, fullName: true, username: true }
        },
        approvedBy: {
          select: { id: true, fullName: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = expenses.map((item) => ({
      ...item,
      createdByName:
        item.createdBy?.fullName || item.createdBy?.username || '-',
      approvedByName:
        item.approvedBy?.fullName || item.approvedBy?.username || '-'
    }));

    res.json(result);
  } catch (error) {
    console.error('getExpenses xatosi:', error);
    res.status(500).json({ error: "Xarajatlarni olishda xatolik" });
  }
};

export const createExpense = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.EXPENSE_CREATE)) {
    return res.status(403).json({
      error: "Sizda xarajat yaratish huquqi yo'q!"
    });
  }

  try {
    const { cashboxId, amount, note, expenseCategoryId } = req.body;

    if (!cashboxId || !amount || !expenseCategoryId) {
      return res.status(400).json({
        error: "Kassa, summa va xarajat moddasi majburiy!"
      });
    }

    if (!note || !String(note).trim()) {
      return res.status(400).json({
        error: "Izoh majburiy!"
      });
    }

    const expense = await prisma.expense.create({
      data: {
        cashboxId: Number(cashboxId),
        amount: Number(amount),
        note: String(note || '').trim() || null,
        expenseCategoryId: Number(expenseCategoryId),
        createdById: req.user.id,
        status: 'Jarayonda'
      },
      include: {
        cashbox: true,
        expenseCategory: {
          include: {
            group: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });

    res.json(expense);
  } catch (error) {
    console.error('createExpense xatosi:', error);
    res.status(500).json({
      error: "Xarajat yaratishda xatolik"
    });
  }
};

export const approveExpense = async (req, res) => {
  if (!canManageExpense(req.user)) {
    return res.status(403).json({
      error: "Sizda xarajatni tasdiqlash huquqi yo'q!"
    });
  }

  try {
    const expenseId = Number(req.params.id);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        cashbox: true,
        expenseCategory: {
          include: {
            group: true
          }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ error: "Xarajat topilmadi" });
    }

    if (expense.status === 'Tasdiqlandi') {
      return res.status(400).json({ error: "Xarajat allaqachon tasdiqlangan" });
    }

    if (expense.status === 'Bekor qilindi') {
      return res.status(400).json({ error: "Bekor qilingan xarajatni tasdiqlab bo'lmaydi" });
    }

    const amount = Number(expense.amount || 0);

    if (Number(expense.cashbox?.balance || 0) < amount) {
      return res.status(400).json({
        error: "Kassada bu xarajat uchun yetarli mablag' yo'q"
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.cashbox.update({
        where: { id: expense.cashboxId },
        data: {
          balance: {
            decrement: amount
          }
        }
      });

      await tx.cashboxTransaction.create({
        data: {
          cashboxId: expense.cashboxId,
          amount,
          type: 'EXPENSE',
          note:
            expense.note ||
            `${expense.expenseCategory?.group?.name || ''} / ${expense.expenseCategory?.name || 'Xarajat'}`,
          userId: req.user.id
        }
      });

      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: 'Tasdiqlandi',
          approvedAt: new Date(),
          approvedById: req.user.id
        }
      });
    });

    return res.json({
      success: true,
      message: "Xarajat tasdiqlandi va kassa amaliyotiga yozildi"
    });
  } catch (error) {
    console.error('approveExpense xatosi:', error);
    return res.status(500).json({
      error: error.message || "Xarajatni tasdiqlashda xatolik"
    });
  }
};

export const deleteExpense = async (req, res) => {
  if (!canManageExpense(req.user)) {
    return res.status(403).json({
      error: "Sizda xarajatni o'chirish huquqi yo'q!"
    });
  }

  try {
    const expenseId = Number(req.params.id);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!expense) {
      return res.status(404).json({
        error: "Xarajat topilmadi"
      });
    }

    if (expense.status === 'Tasdiqlandi') {
      return res.status(400).json({
        error: "Tasdiqlangan xarajatni o'chirib bo'lmaydi"
      });
    }

    await prisma.expense.delete({
      where: { id: expenseId }
    });

    res.json({
      success: true,
      message: "Xarajat o'chirildi"
    });
  } catch (error) {
    console.error('deleteExpense xatosi:', error);
    res.status(500).json({
      error: "O'chirishda xatolik"
    });
  }
};

export const cancelExpense = async (req, res) => {
  if (!canManageExpense(req.user)) {
    return res.status(403).json({
      error: "Sizda xarajatni bekor qilish huquqi yo'q!"
    });
  }

  try {
    const expenseId = Number(req.params.id);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!expense) {
      return res.status(404).json({
        error: "Xarajat topilmadi"
      });
    }

    if (expense.status !== 'Jarayonda') {
      return res.status(400).json({
        error: "Faqat jarayondagi xarajat bekor qilinadi"
      });
    }

    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: 'Bekor qilindi'
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('cancelExpense xatosi:', error);
    res.status(500).json({
      error: "Bekor qilishda xatolik"
    });
  }
};