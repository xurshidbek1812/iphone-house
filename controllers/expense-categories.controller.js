import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

const canManageExpenseCategories = (user) => {
  return hasPermission(user, PERMISSIONS.EXPENSE_CATEGORY_MANAGE);
};

export const getExpenseCategoryGroups = async (req, res) => {
  try {
    const groups = await prisma.expenseCategoryGroup.findMany({
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(groups);
  } catch (error) {
    console.error('getExpenseCategoryGroups xatosi:', error);
    res.status(500).json({ error: "Xarajat moddalari guruhlarini olishda xatolik" });
  }
};

export const createExpenseCategoryGroup = async (req, res) => {
  if (!canManageExpenseCategories(req.user)) {
    return res.status(403).json({ error: "Sizda xarajat guruhini boshqarish huquqi yo'q!" });
  }

  try {
    const name = String(req.body?.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Guruh nomi majburiy!' });
    }

    const group = await prisma.expenseCategoryGroup.create({
      data: { name }
    });

    res.json(group);
  } catch (error) {
    console.error('createExpenseCategoryGroup xatosi:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Bu guruh allaqachon mavjud!' });
    }

    res.status(500).json({ error: "Xarajat guruhi yaratishda xatolik" });
  }
};

export const updateExpenseCategoryGroup = async (req, res) => {
  if (!canManageExpenseCategories(req.user)) {
    return res.status(403).json({ error: "Sizda xarajat guruhini boshqarish huquqi yo'q!" });
  }

  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Guruh nomi majburiy!' });
    }

    const group = await prisma.expenseCategoryGroup.update({
      where: { id },
      data: { name }
    });

    res.json(group);
  } catch (error) {
    console.error('updateExpenseCategoryGroup xatosi:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Bu guruh nomi allaqachon mavjud!' });
    }

    res.status(500).json({ error: "Xarajat guruhi tahrirlashda xatolik" });
  }
};

export const deleteExpenseCategoryGroup = async (req, res) => {
  if (!canManageExpenseCategories(req.user)) {
    return res.status(403).json({ error: "Sizda xarajat guruhini boshqarish huquqi yo'q!" });
  }

  try {
    const id = Number(req.params.id);

    const group = await prisma.expenseCategoryGroup.findUnique({
      where: { id },
      include: { categories: true }
    });

    if (!group) {
      return res.status(404).json({ error: 'Guruh topilmadi!' });
    }

    const categoryIds = group.categories.map((c) => c.id);

    const usedExpense = categoryIds.length
      ? await prisma.expense.findFirst({
          where: {
            expenseCategoryId: { in: categoryIds }
          }
        })
      : null;

    if (usedExpense) {
      return res.status(400).json({
        error: "Bu guruhga bog'langan xarajatlar mavjud. O'chirib bo'lmaydi!"
      });
    }

    await prisma.expenseCategoryGroup.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('deleteExpenseCategoryGroup xatosi:', error);
    res.status(500).json({ error: "Xarajat guruhi o'chirishda xatolik" });
  }
};

export const createExpenseCategory = async (req, res) => {
  if (!canManageExpenseCategories(req.user)) {
    return res.status(403).json({ error: "Sizda xarajat moddasini boshqarish huquqi yo'q!" });
  }

  try {
    const name = String(req.body?.name || '').trim();
    const groupId = Number(req.body?.groupId);

    if (!name || !groupId) {
      return res.status(400).json({ error: 'Guruh va modda nomi majburiy!' });
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name,
        groupId
      },
      include: {
        group: true
      }
    });

    res.json(category);
  } catch (error) {
    console.error('createExpenseCategory xatosi:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Bu modda shu guruh ichida allaqachon mavjud!' });
    }

    res.status(500).json({ error: "Xarajat moddasi yaratishda xatolik" });
  }
};

export const updateExpenseCategory = async (req, res) => {
  if (!canManageExpenseCategories(req.user)) {
    return res.status(403).json({ error: "Sizda xarajat moddasini boshqarish huquqi yo'q!" });
  }

  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || '').trim();
    const groupId = Number(req.body?.groupId);

    if (!name || !groupId) {
      return res.status(400).json({ error: 'Guruh va modda nomi majburiy!' });
    }

    const category = await prisma.expenseCategory.update({
      where: { id },
      data: {
        name,
        groupId
      },
      include: {
        group: true
      }
    });

    res.json(category);
  } catch (error) {
    console.error('updateExpenseCategory xatosi:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Bu modda shu guruh ichida allaqachon mavjud!' });
    }

    res.status(500).json({ error: "Xarajat moddasi tahrirlashda xatolik" });
  }
};

export const deleteExpenseCategory = async (req, res) => {
  if (!canManageExpenseCategories(req.user)) {
    return res.status(403).json({ error: "Sizda xarajat moddasini boshqarish huquqi yo'q!" });
  }

  try {
    const id = Number(req.params.id);

    const usedExpense = await prisma.expense.findFirst({
      where: { expenseCategoryId: id }
    });

    if (usedExpense) {
      return res.status(400).json({
        error: "Bu modda xarajatlarda ishlatilgan. O'chirib bo'lmaydi!"
      });
    }

    await prisma.expenseCategory.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('deleteExpenseCategory xatosi:', error);
    res.status(500).json({ error: "Xarajat moddasi o'chirishda xatolik" });
  }
};