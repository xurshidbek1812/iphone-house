import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { logActivity } from '../utils/activityLog.js';

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
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    const where = search
      ? {
          OR: [
            {
              note: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              status: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              cashbox: {
                name: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            },
            {
              createdBy: {
                fullName: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            },
            {
              approvedBy: {
                fullName: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            },
            {
              expenseCategory: {
                name: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            },
            {
              expenseCategory: {
                group: {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              }
            }
          ]
        }
      : {};

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          cashbox: true,
          createdBy: {
            select: { id: true, fullName: true, username: true }
          },
          approvedBy: {
            select: { id: true, fullName: true, username: true }
          },
          cancelledBy: {
            select: { id: true, fullName: true, username: true }
          },
          expenseCategory: {
            include: {
              group: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    const items = expenses.map((item) => ({
      ...item,
      createdByName:
        item.createdBy?.fullName || item.createdBy?.username || '-',
      approvedByName:
        item.approvedBy?.fullName || item.approvedBy?.username || '-'
    }));

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
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

    if (!cashboxId || !amount) {
      return res.status(400).json({
        error: "Kassa va summa majburiy!"
      });
    }

    if (!note || !String(note).trim()) {
      return res.status(400).json({
        error: "Izoh majburiy!"
      });
    }

    if (!expenseCategoryId) {
      return res.status(400).json({
        error: "Xarajat moddasi majburiy!"
      });
    }

    const expense = await prisma.expense.create({
      data: {
        cashboxId: Number(cashboxId),
        expenseCategoryId: Number(expenseCategoryId),
        amount: Number(amount),
        note: String(note).trim(),
        createdById: req.user.id,
        status: 'Jarayonda'
      },
      include: {
        cashbox: true,
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
        },
        expenseCategory: {
          include: {
            group: true
          }
        }
      }
    });

    await logActivity(prisma, {
      actor: req.user,
      action: 'CREATE',
      entityType: 'Expense',
      entityId: expense.id,
      entityLabel: expense.note || expense.expenseCategory?.name || `Xarajat #${expense.id}`,
      toStatus: 'Jarayonda'
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
      include: { cashbox: true }
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
          note: expense.note || "Tasdiqlangan xarajat",
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

      await logActivity(tx, {
        actor: req.user,
        action: 'APPROVE',
        entityType: 'Expense',
        entityId: expense.id,
        entityLabel: expense.note || `Xarajat #${expense.id}`,
        fromStatus: 'Jarayonda',
        toStatus: 'Tasdiqlandi'
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

    await logActivity(prisma, {
      actor: req.user,
      action: 'DELETE',
      entityType: 'Expense',
      entityId: expense.id,
      entityLabel: expense.note || `Xarajat #${expense.id}`,
      fromStatus: expense.status
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
        status: 'Bekor qilindi',
        cancelledById: req.user.id,
        cancelledAt: new Date()
      }
    });

    await logActivity(prisma, {
      actor: req.user,
      action: 'CANCEL',
      entityType: 'Expense',
      entityId: expense.id,
      entityLabel: expense.note || `Xarajat #${expense.id}`,
      fromStatus: 'Jarayonda',
      toStatus: 'Bekor qilindi'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('cancelExpense xatosi:', error);
    res.status(500).json({
      error: "Bekor qilishda xatolik"
    });
  }
};